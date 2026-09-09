import { apiError, apiJson, readJsonObject } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { bridgeAuthorized } from "@/lib/attendanceBridgeAuth";

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
    && row.enroll_number.length <= 64
    && typeof row.punched_at === "string"
    && Number.isFinite(Date.parse(row.punched_at));
};

export async function POST(request: Request) {
  if (!bridgeAuthorized(request)) return apiError("unauthenticated", 401);
  const body = await readJsonObject(request);
  const requestId = typeof body?.request_id === "string" ? body.request_id : "";
  const deviceId = typeof body?.device_id === "string" ? body.device_id : "";
  const punches = Array.isArray(body?.punches) ? body.punches.filter(isPunch).slice(0, 20000) : [];
  if (!requestId || !deviceId || punches.length !== (Array.isArray(body?.punches) ? body.punches.length : 0)) {
    return apiError("invalid_request", 400);
  }

  const { data: requestRow, error: requestError } = await serverSupabase
    .from("attendance_sync_requests")
    .select("id,status")
    .eq("id", requestId)
    .maybeSingle();
  if (requestError || !requestRow || requestRow.status !== "running") return apiError("conflict", 409);

  const payload = punches.map((punch) => ({
    device_id: deviceId,
    enroll_number: punch.enroll_number,
    punched_at: punch.punched_at,
    verify_mode: punch.verify_mode ?? null,
    in_out_mode: punch.in_out_mode ?? null,
    work_code: punch.work_code ?? null,
  }));
  const { error: punchError } = await serverSupabase
    .from("attendance_punches")
    .upsert(payload, { onConflict: "device_id,enroll_number,punched_at", ignoreDuplicates: true });
  if (punchError) return failRequest(requestId, punchError.message);

  const enrollments = [...new Set(punches.map((punch) => punch.enroll_number))];
  const { data: users, error: userError } = await serverSupabase
    .from("staff_users")
    .select("id,full_name,attendance_code")
    .in("attendance_code", enrollments)
    .eq("active", true);
  if (userError) return failRequest(requestId, userError.message);
  const userByCode = new Map((users ?? []).map((user) => [user.attendance_code, user]));
  const daily = new Map<string, { user_id: string; work_date: string; check_in: string; check_out: string }>();
  for (const punch of punches) {
    const user = userByCode.get(punch.enroll_number);
    if (!user) continue;
    const instant = new Date(punch.punched_at);
    const date = instant.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
    const time = instant.toLocaleTimeString("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
    const key = `${user.id}:${date}`;
    const current = daily.get(key);
    if (!current) daily.set(key, { user_id: user.id, work_date: date, check_in: time, check_out: time });
    else {
      if (time < current.check_in) current.check_in = time;
      if (time > current.check_out) current.check_out = time;
    }
  }
  const logs = [...daily.values()].map((row) => ({
    user_id: row.user_id,
    work_date: row.work_date,
    check_in: row.check_in,
    check_out: row.check_out === row.check_in ? null : row.check_out,
    status: "present",
    source: "wise_eye",
    note: "Đồng bộ từ Wise Eye On 39",
    synced_at: new Date().toISOString(),
  }));
  if (logs.length) {
    const { error: logError } = await serverSupabase
      .from("attendance_logs")
      .upsert(logs, { onConflict: "user_id,work_date" });
    if (logError) return failRequest(requestId, logError.message);
  }
  const result = { punches_received: punches.length, matched_users: userByCode.size, daily_logs: logs.length };
  const { error: doneError } = await serverSupabase
    .from("attendance_sync_requests")
    .update({ status: "succeeded", completed_at: new Date().toISOString(), result })
    .eq("id", requestId)
    .eq("status", "running");
  if (doneError) return apiError("operation_failed", 500);
  return apiJson({ ok: true, result });
}

async function failRequest(requestId: string, error: string) {
  await serverSupabase.from("attendance_sync_requests").update({
    status: "failed",
    completed_at: new Date().toISOString(),
    error: error.slice(0, 500),
  }).eq("id", requestId).eq("status", "running");
  return apiError("operation_failed", 500);
}
