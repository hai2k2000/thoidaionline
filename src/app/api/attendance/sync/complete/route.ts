import { apiError, apiJson, readJsonObject } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { bridgeAuthorized, configuredAttendanceDeviceId, validateAttendanceRange } from "@/lib/attendanceBridgeAuth";
import { deriveAttendanceDays, punchKey } from "@/lib/attendanceReconciliation";

type Punch = {
  enroll_number: string;
  punched_at: string;
  verify_mode?: number;
  in_out_mode?: number;
  work_code?: number;
};

const isPunch = (value: unknown): value is Punch => {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.enroll_number === "string"
    && row.enroll_number.trim().length > 0
    && row.enroll_number.length <= 64
    && typeof row.punched_at === "string"
    && Number.isFinite(Date.parse(row.punched_at));
};

export async function POST(request: Request) {
  if (!(await bridgeAuthorized(request))) return apiError("unauthenticated", 401);
  const body = await readJsonObject(request);
  const requestId = typeof body?.request_id === "string" ? body.request_id : "";
  const deviceId = typeof body?.device_id === "string" ? body.device_id : "";
  const punchesPayload = Array.isArray(body?.punches) ? body.punches : [];
  const punches = punchesPayload.filter(isPunch);
  if (!requestId || !deviceId || punchesPayload.length > 100000 || punches.length !== punchesPayload.length) {
    return apiError("invalid_request", 400);
  }

  const { data: requestRow, error: requestError } = await serverSupabase
    .from("attendance_sync_requests")
    .select("id,status,result")
    .eq("id", requestId)
    .maybeSingle();
  const configuredDeviceId = configuredAttendanceDeviceId();
  const requestResult = requestRow?.result as { device_id?: string; period?: string; range_start?: string; range_end?: string; dry_run?: boolean; source?: string } | null;
  const requestDeviceId = requestResult?.device_id ?? "";
  const rangeStart = requestResult?.range_start ?? "";
  const rangeEnd = requestResult?.range_end ?? "";
  const period = requestResult?.period ?? "";
  const dryRun = requestResult?.dry_run === true;
  if (requestError || !requestRow || requestRow.status !== "running" || requestDeviceId !== configuredDeviceId || deviceId !== configuredDeviceId || !validateAttendanceRange(period, rangeStart, rangeEnd)) return apiError("conflict", 409);
  if (punches.some((punch) => {
    const punchDate = new Date(punch.punched_at).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
    return punchDate < rangeStart || punchDate > rangeEnd;
  })) return apiError("invalid_request", 400);
  const { data: claimed, error: claimError } = await serverSupabase.from("attendance_sync_requests")
    .update({ status: "completing", started_at: new Date().toISOString() })
    .eq("id", requestId).eq("status", "running")
    .select("id,status,result").maybeSingle();
  if (claimError || !claimed || claimed.status !== "completing") return apiError("conflict", 409);

  const payload = punches.map((punch) => ({
    device_id: deviceId,
    enroll_number: punch.enroll_number,
    punched_at: punch.punched_at,
    verify_mode: punch.verify_mode ?? null,
    in_out_mode: punch.in_out_mode ?? null,
    work_code: punch.work_code ?? null,
  }));
  const enrollments = [...new Set(punches.map((punch) => punch.enroll_number))];
  const rangeStartInstant = new Date(`${rangeStart}T00:00:00+07:00`);
  const rangeEndExclusive = new Date(`${rangeEnd}T00:00:00+07:00`);
  rangeEndExclusive.setUTCDate(rangeEndExclusive.getUTCDate() + 1);
  let beforeRows: Array<{ device_id: string; enroll_number: string; punched_at: string }> = [];
  if (enrollments.length) {
    const { data, error: beforeError } = await serverSupabase
      .from("attendance_punches")
      .select("device_id,enroll_number,punched_at")
      .eq("device_id", configuredDeviceId)
      .in("enroll_number", enrollments)
      .gte("punched_at", rangeStartInstant.toISOString())
      .lt("punched_at", rangeEndExclusive.toISOString())
      .limit(100000);
    if (beforeError) return failRequest(requestId, beforeError.message);
    beforeRows = (data ?? []) as Array<{ device_id: string; enroll_number: string; punched_at: string }>;
  }
  const beforeKeys = new Set(beforeRows.map(punchKey));
  const insertedCount = payload.filter((punch) => !beforeKeys.has(punchKey(punch))).length;
  const duplicateSkippedCount = payload.length - insertedCount;
  const { data: users, error: userError } = await serverSupabase
    .from("staff_users")
    .select("id,full_name,attendance_code")
    .in("attendance_code", enrollments)
    .eq("active", true);
  if (userError) return failRequest(requestId, userError.message);
  const userByCode = new Map((users ?? []).map((user) => [user.attendance_code, user]));
  if (dryRun) {
    const mappedDays = deriveAttendanceDays(payload).filter((row) => userByCode.has(row.enroll_number));
    const result = { source: requestResult?.source ?? "reconcile", dry_run: true, range_start: rangeStart, range_end: rangeEnd, device_punch_count: punches.length, db_before_count: beforeRows.length, inserted_count: insertedCount, duplicate_skipped_count: duplicateSkippedCount, matched_users: userByCode.size, attendance_rows_recalculated: mappedDays.length };
    const { data: completed, error: doneError } = await serverSupabase
      .from("attendance_sync_requests")
      .update({ status: "succeeded", completed_at: new Date().toISOString(), finished_at: new Date().toISOString(), result })
      .eq("id", requestId).eq("status", "completing")
      .select("id,status")
      .maybeSingle();
    if (doneError || !completed) return failRequest(requestId, doneError?.message ?? "Dry-run was not committed");
    return apiJson({ ok: true, result });
  }
  const { error: punchError } = await serverSupabase
    .from("attendance_punches")
    .upsert(payload, { onConflict: "device_id,enroll_number,punched_at", ignoreDuplicates: true });
  if (punchError) return failRequest(requestId, punchError.message);

  const canonicalPunches: Array<{ enroll_number: string; punched_at: string; verify_mode: number | null; in_out_mode: number | null; work_code: number | null }> = [];
  const pageSize = 10000;
  let page = 0;
  while (true) {
    const { data: pageRows, error: canonicalError } = await serverSupabase
      .from("attendance_punches")
      .select("enroll_number,punched_at,verify_mode,in_out_mode,work_code")
      .eq("device_id", configuredDeviceId)
      .in("enroll_number", enrollments)
      .gte("punched_at", rangeStartInstant.toISOString())
      .lt("punched_at", rangeEndExclusive.toISOString())
      .order("punched_at", { ascending: true })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (canonicalError) return failRequest(requestId, canonicalError.message);
    canonicalPunches.push(...(pageRows ?? []));
    if (!pageRows || pageRows.length < pageSize) break;
    page += 1;
  }
  const daily = new Map<string, { user_id: string; work_date: string; earliest: Date; latest: Date }>();
  for (const punch of (canonicalPunches ?? [])) {
    const user = userByCode.get(punch.enroll_number);
    if (!user) continue;
    const instant = new Date(punch.punched_at);
    const date = instant.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
    const key = `${user.id}:${date}`;
    const current = daily.get(key);
    if (!current) daily.set(key, { user_id: user.id, work_date: date, earliest: instant, latest: instant });
    else {
      if (instant.getTime() < current.earliest.getTime()) current.earliest = instant;
      if (instant.getTime() > current.latest.getTime()) current.latest = instant;
    }
  }
  const logs = [...daily.values()].map((row) => {
    const checkIn = row.earliest.toLocaleTimeString("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
    const checkOut = row.latest.toLocaleTimeString("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
    return {
      user_id: row.user_id,
      work_date: row.work_date,
      check_in: checkIn,
      check_out: row.latest.getTime() === row.earliest.getTime() ? null : checkOut,
      status: "present",
      source: "wise_eye",
      note: "Đồng bộ từ Wise Eye On 39",
      synced_at: new Date().toISOString(),
    };
  });
  for (const log of logs) {
    const { error: logError } = await serverSupabase.rpc("api_merge_attendance_log", {
      p_user_id: log.user_id,
      p_work_date: log.work_date,
      p_check_in: log.check_in,
      p_check_out: log.check_out,
      p_source: log.source,
      p_note: log.note,
    });
    if (logError) return failRequest(requestId, logError.message);
  }
  const result = { source: requestResult?.source ?? "sync", dry_run: false, range_start: rangeStart, range_end: rangeEnd, punches_received: punches.length, device_punch_count: punches.length, db_before_count: beforeRows.length, inserted_count: insertedCount, duplicate_skipped_count: duplicateSkippedCount, matched_users: userByCode.size, daily_logs: logs.length, attendance_rows_recalculated: logs.length };
  const { data: completed, error: doneError } = await serverSupabase
    .from("attendance_sync_requests")
    .update({ status: "succeeded", completed_at: new Date().toISOString(), finished_at: new Date().toISOString(), result })
    .eq("id", requestId)
    .eq("status", "completing")
    .select("id,status")
    .maybeSingle();
  if (doneError || !completed || completed.status !== "succeeded") return failRequest(requestId, doneError?.message ?? "Sync completion was not committed");
  return apiJson({ ok: true, result });
}

async function failRequest(requestId: string, error: string) {
  await serverSupabase.from("attendance_sync_requests").update({
    status: "failed",
    completed_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    error: error.slice(0, 500),
  }).eq("id", requestId).in("status", ["running", "completing"]);
  return apiError("operation_failed", 500);
}
