import { apiError, apiJson, readJsonObject } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { bridgeAuthorized, configuredAttendanceDeviceId, validateAttendanceRange, vietnamDate } from "@/lib/attendanceBridgeAuth";

export async function POST(request: Request) {
  if (!(await bridgeAuthorized(request))) return apiError("unauthenticated", 401);
  const body = await readJsonObject(request);
  const bodyDeviceId = typeof body?.device_id === "string" ? body.device_id : configuredAttendanceDeviceId();
  const bodyPeriod = typeof body?.period === "string" ? body.period : "range";
  const today = vietnamDate();
  const defaultStart = new Date(`${today}T12:00:00Z`);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 2);
  const rangeStart = typeof body?.range_start === "string" ? body.range_start : defaultStart.toISOString().slice(0, 10);
  const rangeEnd = typeof body?.range_end === "string" ? body.range_end : today;
  if (bodyDeviceId !== configuredAttendanceDeviceId() || !validateAttendanceRange(bodyPeriod, rangeStart, rangeEnd)) return apiError("invalid_request", 400);
  const { data: existing } = await serverSupabase
    .from("attendance_sync_requests")
    .select("id,status,requested_at")
    .in("status", ["pending", "running", "completing"])
    .order("requested_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) return apiJson({ request: existing });
  const { data, error } = await serverSupabase
    .from("attendance_sync_requests")
    .insert({
      status: "pending",
      result: {
        source: typeof body?.source === "string" ? body.source : "daily",
        device_id: bodyDeviceId,
        period: bodyPeriod,
        range_start: rangeStart,
        range_end: rangeEnd,
        dry_run: body?.dry_run === true,
      },
    })
    .select("id,status,requested_at")
    .single();
  if (error?.code === "23505") {
    const { data: active } = await serverSupabase.from("attendance_sync_requests").select("id,status,requested_at").in("status", ["pending", "running", "completing"]).order("requested_at", { ascending: true }).limit(1).maybeSingle();
    if (active) return apiJson({ request: active });
  }
  if (error || !data) return apiError("operation_failed", 500);
  return apiJson({ request: data }, 201);
}
