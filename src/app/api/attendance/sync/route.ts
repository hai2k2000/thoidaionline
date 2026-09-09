import { apiError, apiJson, readJsonObject, requireMutationActor } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { bridgeAuthorized } from "@/lib/attendanceBridgeAuth";

const isAdmin = (actor: { role_code: string }) => actor.role_code === "admin";

export async function GET(request: Request) {
  if (!bridgeAuthorized(request)) return apiError("unauthenticated", 401);
  const { data: existing } = await serverSupabase
    .from("attendance_sync_requests")
    .select("id,status,requested_at")
    .in("status", ["pending", "running"])
    .order("requested_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) return apiJson({ request: existing });
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
  const deviceId = typeof body?.device_id === "string" ? body.device_id : "wise-eye-on-39-machine-1";
  const { data, error } = await serverSupabase
    .from("attendance_sync_requests")
    .insert({ requested_by: guard.actor.id, status: "pending", result: { device_id: deviceId } })
    .select("id,status,requested_at")
    .single();
  if (error?.code === "23505") {
    const { data: active } = await serverSupabase.from("attendance_sync_requests").select("id,status,requested_at").in("status", ["pending", "running"]).order("requested_at", { ascending: true }).limit(1).maybeSingle();
    if (active) return apiJson({ request: active });
  }
  if (error || !data) return apiError("operation_failed", 500);
  return apiJson({ request: data }, 201);
}
