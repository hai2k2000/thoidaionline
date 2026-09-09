import { apiError, apiJson, requireReadActor } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";

export async function GET() {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  if (guard.actor.role_code !== "admin") return apiError("forbidden", 403);
  const { data, error } = await serverSupabase
    .from("attendance_sync_requests")
    .select("id,status,requested_at,started_at,completed_at,result,error")
    .order("requested_at", { ascending: false })
    .limit(5);
  if (error) return apiError("operation_failed", 500);
  return apiJson({ requests: data ?? [] });
}
