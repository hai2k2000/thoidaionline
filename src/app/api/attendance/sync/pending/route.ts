import { apiError, apiJson } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { bridgeAuthorized } from "@/lib/attendanceBridgeAuth";

export async function GET(request: Request) {
  if (!bridgeAuthorized(request)) return apiError("unauthenticated", 401);
  const reclaimBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: pending, error } = await serverSupabase
    .from("attendance_sync_requests")
    .select("id,status,requested_at,started_at,result")
    .or(`status.eq.pending,and(status.eq.completing,started_at.lt.${reclaimBefore})`)
    .order("requested_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return apiError("operation_failed", 500);
  if (!pending) return apiJson({ request: null });
  const { data: claimed, error: claimError } = await serverSupabase
    .from("attendance_sync_requests")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", pending.id)
    .or(`status.eq.pending,and(status.eq.completing,started_at.lt.${reclaimBefore})`)
    .select("id,status,requested_at,started_at,result")
    .maybeSingle();
  if (claimError) return apiError("operation_failed", 500);
  return apiJson({ request: claimed ?? null });
}
