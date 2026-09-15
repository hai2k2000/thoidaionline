import { apiError, apiJson, readJsonObject, requireMutationActor, requireReadActor, rpcFailure } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { parseMineLeaveFilters } from "@/lib/leaveRequestFilters.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PERIODS = new Set(["full", "morning", "afternoon"]);
const TYPES = new Set(["annual", "sick", "unpaid", "personal", "business"]);
const REVIEW_ROLES = new Set(["admin", "tong_bien_tap", "pho_tong_bien_tap", "phu_trach_phong_tri_su", "phu_trach_phong_phong_vien", "phu_trach_phong_bien_tap"]);
const TBT_ROLE = "tong_bien_tap";
const GLOBAL_REVIEW_ROLES = new Set(["admin", "tong_bien_tap", "pho_tong_bien_tap"]);

const canReview = (actor: { role_code: string; is_department_manager?: boolean }) => actor.is_department_manager === true || REVIEW_ROLES.has(actor.role_code);
const isValidDate = (value: string) => {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
const leaveDays = (startDate: string, endDate: string) => Math.floor((Date.parse(`${endDate}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / 86_400_000) + 1;
const requiresTbtApproval = (startDate: string, endDate: string) => leaveDays(startDate, endDate) >= 3;

export async function GET(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (!isValidDate(from) || !isValidDate(to) || from > to) return apiError("invalid_request", 400);
  const mineScope = parseMineLeaveFilters(params, from, to);
  if (!mineScope) return apiError("invalid_request", 400);
  const fields = "id,requester_id,department_id,start_date,end_date,start_period,end_period,leave_type,reason,status,reviewed_by,reviewed_at,review_note,created_at,requester:staff_users!leave_requests_requester_id_fkey(full_name),reviewer:staff_users!leave_requests_reviewed_by_fkey(full_name)";
  let mineQuery = serverSupabase.from("leave_requests").select(fields).eq("requester_id", guard.actor.id).order("created_at", { ascending: false }).limit(1000);
  if (mineScope.from && mineScope.to) mineQuery = mineQuery.lte("start_date", mineScope.to).gte("end_date", mineScope.from);
  if (mineScope.status !== "all") mineQuery = mineQuery.eq("status", mineScope.status);
  const mine = await mineQuery;
  if (mine.error) return apiError("operation_failed", 500);
  let approvals: unknown[] = [];
  if (canReview(guard.actor)) {
    let query = serverSupabase.from("leave_requests").select(fields).eq("status", "pending").lte("start_date", to).gte("end_date", from).order("created_at", { ascending: true }).limit(200);
    if (!GLOBAL_REVIEW_ROLES.has(guard.actor.role_code)) query = query.eq("department_id", guard.actor.department_id ?? "");
    const result = await query;
    if (result.error) return apiError("operation_failed", 500);
    approvals = (result.data ?? []).filter((item) => {
      const row = item as { start_date: string; end_date: string };
      return !requiresTbtApproval(row.start_date, row.end_date) || guard.actor.role_code === TBT_ROLE;
    });
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
  if (!isValidDate(startDate) || !isValidDate(endDate) || endDate < startDate || !PERIODS.has(startPeriod) || !PERIODS.has(endPeriod) || !TYPES.has(leaveType) || reason.length < 3 || reason.length > 1000) return apiError("invalid_request", 400);
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
  const leave = await serverSupabase.from("leave_requests").select("start_date,end_date").eq("id", id).eq("status", "pending").maybeSingle();
  if (leave.error) return apiError("operation_failed", 500);
  if (!leave.data) return apiError("not_found", 404);
  if (requiresTbtApproval(leave.data.start_date, leave.data.end_date) && guard.actor.role_code !== TBT_ROLE) return apiError("forbidden", 403);
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (action === "reject" && note.length < 3) return apiError("invalid_request", 400);
  const result = await serverSupabase.rpc("api_review_leave_request", { p_actor: guard.actor.id, p_request_id: id, p_decision: action === "approve" ? "approved" : "rejected", p_note: note });
  return result.error ? rpcFailure(result.error) : apiJson({ request: result.data });
}
