import { apiError, apiJson, readJsonObject, requireMutationActor, requireReadActor, rpcFailure } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { parseMineLeaveFilters } from "@/lib/leaveRequestFilters.mjs";
import { canReviewAnyLeave, getApprovalCapabilities } from "@/lib/rbac/approval";
import type { RpcError } from "@/lib/rpcErrorMapping";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PERIODS = new Set(["full", "morning", "afternoon"]);
const TYPES = new Set(["annual", "sick", "unpaid", "personal", "business"]);
const isValidDate = (value: string) => {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};

export async function GET(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (!isValidDate(from) || !isValidDate(to) || from > to) return apiError("invalid_request", 400);
  const mineScope = parseMineLeaveFilters(params, from, to);
  if (!mineScope) return apiError("invalid_request", 400);
  let capabilities;
  try {
    capabilities = await getApprovalCapabilities(guard.actor.id);
  } catch (error) {
    return rpcFailure(error as RpcError);
  }
  const fields = "id,requester_id,department_id,start_date,end_date,start_period,end_period,leave_type,reason,status,reviewed_by,reviewed_at,review_note,created_at,requester:staff_users!leave_requests_requester_id_fkey(full_name),reviewer:staff_users!leave_requests_reviewed_by_fkey(full_name)";
  let mineQuery = serverSupabase.from("leave_requests").select(fields).eq("requester_id", guard.actor.id).order("created_at", { ascending: false }).limit(1000);
  if (mineScope.from && mineScope.to) mineQuery = mineQuery.lte("start_date", mineScope.to).gte("end_date", mineScope.from);
  if (mineScope.status !== "all") mineQuery = mineQuery.eq("status", mineScope.status);
  const mine = await mineQuery;
  if (mine.error) return apiError("operation_failed", 500);
  let approvals: unknown[] = [];
  const approvalList = await serverSupabase.rpc("api_list_reviewable_leave_requests", { p_actor: guard.actor.id, p_from: from, p_to: to });
  if (approvalList.error) return rpcFailure(approvalList.error);
  const approvalIds = (approvalList.data ?? []) as { id: string; approval_basis: string }[];
  if (approvalIds.length > 0) {
    const result = await serverSupabase.from("leave_requests").select(fields).in("id", approvalIds.map((row) => row.id));
    if (result.error) return apiError("operation_failed", 500);
    const byId = new Map((result.data ?? []).map((row) => [row.id, row]));
    approvals = approvalIds.map((row) => ({ ...byId.get(row.id), approval_basis: row.approval_basis })).filter((row) => row.id);
  }
  let management: unknown[] = [];
  if (guard.actor.role_code === "admin") {
    const result = await serverSupabase.from("leave_requests").select(fields).lte("start_date", to).gte("end_date", from).order("created_at", { ascending: false }).limit(500);
    if (result.error) return apiError("operation_failed", 500);
    management = result.data ?? [];
  }
  return apiJson({ mine: mine.data ?? [], approvals, management, canReviewLeave: canReviewAnyLeave(capabilities) });
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
  if (action === "edit") {
    const startDate = typeof body?.startDate === "string" ? body.startDate : "";
    const endDate = typeof body?.endDate === "string" ? body.endDate : "";
    const startPeriod = typeof body?.startPeriod === "string" ? body.startPeriod : "full";
    const endPeriod = typeof body?.endPeriod === "string" ? body.endPeriod : "full";
    const leaveType = typeof body?.leaveType === "string" ? body.leaveType : "annual";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (!isValidDate(startDate) || !isValidDate(endDate) || endDate < startDate || !PERIODS.has(startPeriod) || !PERIODS.has(endPeriod) || !TYPES.has(leaveType) || reason.length < 3 || reason.length > 1000) return apiError("invalid_request", 400);
    const result = await serverSupabase.rpc("api_edit_leave_request", { p_actor: guard.actor.id, p_request_id: id, p_start_date: startDate, p_end_date: endDate, p_start_period: startPeriod, p_end_period: endPeriod, p_leave_type: leaveType, p_reason: reason });
    return result.error ? rpcFailure(result.error) : apiJson({ request: result.data });
  }
  if (action === "cancel") {
    const result = await serverSupabase.rpc("api_cancel_leave_request", { p_actor: guard.actor.id, p_request_id: id });
    return result.error ? rpcFailure(result.error) : apiJson({ request: result.data });
  }
  if (action !== "approve" && action !== "reject") return apiError("invalid_request", 400);
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (action === "reject" && note.length < 3) return apiError("invalid_request", 400);
  const result = await serverSupabase.rpc("api_review_leave_request", { p_actor: guard.actor.id, p_request_id: id, p_decision: action === "approve" ? "approved" : "rejected", p_note: note });
  return result.error ? rpcFailure(result.error) : apiJson({ request: result.data });
}
