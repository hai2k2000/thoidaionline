import { apiError, apiJson } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { bridgeAuthorized } from "@/lib/attendanceBridgeAuth";

export async function POST(request: Request) {
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
    .insert({ status: "pending", result: { source: "daily", device_id: "wise-eye-on-39-machine-1" } })
    .select("id,status,requested_at")
    .single();
  if (error?.code === "23505") {
    const { data: active } = await serverSupabase.from("attendance_sync_requests").select("id,status,requested_at").in("status", ["pending", "running"]).order("requested_at", { ascending: true }).limit(1).maybeSingle();
    if (active) return apiJson({ request: active });
  }
  if (error || !data) return apiError("operation_failed", 500);
  return apiJson({ request: data }, 201);
}
