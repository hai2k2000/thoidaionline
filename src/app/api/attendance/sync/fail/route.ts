import { apiError, apiJson, readJsonObject } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { bridgeAuthorized } from "@/lib/attendanceBridgeAuth";

export async function POST(request: Request) {
  if (!bridgeAuthorized(request)) return apiError("unauthenticated", 401);
  const body = await readJsonObject(request);
  const requestId = typeof body?.request_id === "string" ? body.request_id : "";
  const error = typeof body?.error === "string" ? body.error.slice(0, 500) : "Bridge sync failed";
  if (!requestId) return apiError("invalid_request", 400);
  const { data, error: updateError } = await serverSupabase
    .from("attendance_sync_requests")
    .update({ status: "failed", completed_at: new Date().toISOString(), error })
    .eq("id", requestId)
    .in("status", ["running", "completing"])
    .select("id,status,completed_at,error")
    .maybeSingle();
  if (updateError) return apiError("operation_failed", 500);
  return apiJson({ ok: true, request: data });
}
