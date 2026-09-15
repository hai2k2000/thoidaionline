import { apiError, apiJson, readJsonObject, requireMutationActor } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { bridgeAuthorized, configuredAttendanceDeviceId, validateAttendanceRange } from "@/lib/attendanceBridgeAuth";

const isAdmin = (actor: { role_code: string }) => actor.role_code === "admin";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  if (!(await bridgeAuthorized(request))) return apiError("unauthenticated", 401);
  const { data, error } = await serverSupabase
    .from("attendance_sync_requests")
    .select("id,status,requested_at,started_at,completed_at,result,error")
    .order("requested_at", { ascending: false })
    .limit(10);
  if (error) return apiError("operation_failed", 500);
  return apiJson({ requests: data ?? [] });
}

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  if (!isAdmin(guard.actor)) return apiError("forbidden", 403);
  const body = await readJsonObject(request);
  const configuredDeviceId = configuredAttendanceDeviceId();
  const deviceId = typeof body?.device_id === "string" ? body.device_id : configuredDeviceId;
  const period = typeof body?.period === "string" ? body.period : "day";
  const rangeStart = typeof body?.range_start === "string" ? body.range_start : "";
  const rangeEnd = typeof body?.range_end === "string" ? body.range_end : "";
  if (deviceId !== configuredDeviceId || !validateAttendanceRange(period, rangeStart, rangeEnd)) {
    return apiError("invalid_request", 400);
  }
  const { data, error } = await serverSupabase
    .from("attendance_sync_requests")
    .insert({ requested_by: guard.actor.id, status: "pending", result: { device_id: deviceId, period, range_start: rangeStart, range_end: rangeEnd } })
    .select("id,status,requested_at")
    .single();
  if (error?.code === "23505") {
    const { data: active } = await serverSupabase.from("attendance_sync_requests").select("id,status,requested_at").in("status", ["pending", "running", "completing"]).order("requested_at", { ascending: true }).limit(1).maybeSingle();
    if (active) return apiJson({ request: active });
  }
  if (error || !data) return apiError("operation_failed", 500);
  return apiJson({ request: data }, 201);
}
