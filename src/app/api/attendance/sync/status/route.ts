import { apiError, apiJson, requireReadActor } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { resolveAttendanceAccess } from "@/lib/attendanceAccess";

export async function GET() {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  if (!(await resolveAttendanceAccess(guard.actor)).canManage) return apiError("forbidden", 403);
  const { data, error } = await serverSupabase
    .from("attendance_sync_requests")
    .select("id,status,requested_at,started_at,finished_at,completed_at,result,error")
    .order("requested_at", { ascending: false })
    .limit(5);
  if (error) return apiError("operation_failed", 500);
  return apiJson({ requests: data ?? [] });
}
