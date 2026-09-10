import { apiError, apiJson, readJsonObject, requireMutationActor, requireReadActor, rpcFailure } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PERIODS = new Set(["full", "morning", "afternoon"]);
const TYPES = new Set(["annual", "sick", "unpaid", "personal", "business"]);
const REVIEW_ROLES = new Set(["admin", "tong_bien_tap", "pho_tong_bien_tap", "phu_trach_phong_tri_su", "phu_trach_phong_phong_vien", "phu_trach_phong_bien_tap"]);

const canReview = (actor: { role_code: string; is_department_manager?: boolean }) => actor.is_department_manager === true || REVIEW_ROLES.has(actor.role_code);

export async function GET(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (!DATE.test(from) || !DATE.test(to) || from > to) return apiError("invalid_request", 400);
  const fields = "id,requester_id,department_id,start_date,end_date,start_period,end_period,leave_type,reason,status,reviewed_by,reviewed_at,review_note,created_at,requester:staff_users!leave_requests_requester_id_fkey(full_name),reviewer:staff_users!leave_requests_reviewed_by_fkey(full_name)";
  const mine = await serverSupabase.from("leave_requests").select(fields).eq("requester_id", guard.actor.id).lte("start_date", to).gte("end_date", from).order("created_at", { ascending: false }).limit(100);
  if (mine.error) return apiError("operation_failed", 500);
  let approvals: unknown[] = [];
  if (canReview(guard.actor)) {
    let query = serverSupabase.from("leave_requests").select(fields).eq("status", "pending").lte("start_date", to).gte("end_date", from).order("created_at", { ascending: true }).limit(200);
    if (guard.actor.role_code !== "admin" && !REVIEW_ROLES.has(guard.actor.role_code)) query = query.eq("department_id", guard.actor.department_id ?? "");
    const result = await query;
    if (result.error) return apiError("operation_failed", 500);
    approvals = result.data ?? [];
  }
  let management: unknown[] = [];
  if (guard.actor.role_code === "admin") {
    const result = await serverSupabase.from("leave_requests").select(fields).lte("start_date", to).gte("end_date", from).order("created_at", { ascending: false }).limit(500);
    if (result.error) return apiError("operation_failed", 500);
    management = result.data ?? [];
  }
  return apiJson({ mine: mine.data ?? [], approvals, management });
}

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = await readJsonObject(request);
  const startDate = typeof body?.startDate === "string" ? body.startDate : "";
  const endDate = typeof body?.endDate === "string" ? body.endDate : "";
  const startPeriod = typeof body?.startPeriod === "string" ? body.startPeriod : "full";
  const endPeriod = typeof body?.endPeriod === "string" ? body.endPeriod : "full";
  const leaveType = typeof body?.leaveType === "string" ? body.leaveType : "annual";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!DATE.test(startDate) || !DATE.test(endDate) || !PERIODS.has(startPeriod) || !PERIODS.has(endPeriod) || !TYPES.has(leaveType) || reason.length < 3 || reason.length > 1000) return apiError("invalid_request", 400);
  const result = await serverSupabase.rpc("api_create_leave_request", { p_actor: guard.actor.id, p_start_date: startDate, p_end_date: endDate, p_start_period: startPeriod, p_end_period: endPeriod, p_leave_type: leaveType, p_reason: reason });
  return result.error ? rpcFailure(result.error) : apiJson({ request: result.data });
}

export async function PATCH(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = await readJsonObject(request);
  const id = typeof body?.id === "string" ? body.id : "";
  const action = typeof body?.action === "string" ? body.action : "";
  if (!id) return apiError("invalid_request", 400);
  if (action === "cancel") {
    const result = await serverSupabase.rpc("api_cancel_leave_request", { p_actor: guard.actor.id, p_request_id: id });
    return result.error ? rpcFailure(result.error) : apiJson({ request: result.data });
  }
  if (action !== "approve" && action !== "reject") return apiError("invalid_request", 400);
  if (!canReview(guard.actor)) return apiError("forbidden", 403);
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (action === "reject" && note.length < 3) return apiError("invalid_request", 400);
  const result = await serverSupabase.rpc("api_review_leave_request", { p_actor: guard.actor.id, p_request_id: id, p_decision: action === "approve" ? "approved" : "rejected", p_note: note });
  return result.error ? rpcFailure(result.error) : apiJson({ request: result.data });
}
