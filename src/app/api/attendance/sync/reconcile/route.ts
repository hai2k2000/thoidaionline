import { apiError, apiJson, readJsonObject, requireMutationActor } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { configuredAttendanceDeviceId, validateAttendanceRange } from "@/lib/attendanceBridgeAuth";

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  if (guard.actor.role_code !== "admin") return apiError("forbidden", 403);
  const body = await readJsonObject(request);
  const rangeStart = typeof body?.range_start === "string" ? body.range_start : "";
  const rangeEnd = typeof body?.range_end === "string" ? body.range_end : "";
  const dryRun = body?.dry_run !== false;
  if (!validateAttendanceRange("range", rangeStart, rangeEnd)) return apiError("invalid_request", 400);

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
      requested_by: guard.actor.id,
      status: "pending",
      result: {
        source: "reconcile",
        device_id: configuredAttendanceDeviceId(),
        period: "range",
        range_start: rangeStart,
        range_end: rangeEnd,
        dry_run: dryRun,
      },
    })
    .select("id,status,requested_at,result")
    .single();
  if (error?.code === "23505") {
    const { data: active } = await serverSupabase.from("attendance_sync_requests").select("id,status,requested_at,result").in("status", ["pending", "running", "completing"]).order("requested_at", { ascending: true }).limit(1).maybeSingle();
    if (active) return apiJson({ request: active });
  }
  if (error || !data) return apiError("operation_failed", 500);
  return apiJson({ request: data }, 201);
}
