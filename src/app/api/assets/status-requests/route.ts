import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { toAssetRepositoryActor } from "@/lib/assetApiActor";
import { canManageAssets } from "@/lib/assetAuthorization";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const NO_STORE = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };
const json = (body: unknown, init?: ResponseInit) => NextResponse.json(body, { ...init, headers: NO_STORE });

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) return json({ error: "unauthenticated" }, { status: 401 });
  const actor = toAssetRepositoryActor(session);
  const mine = new URL(request.url).searchParams.get("mine") === "1";
  if (!mine && !canManageAssets(actor)) return json({ error: "forbidden" }, { status: 403 });
  let query = serverSupabase.from("asset_status_change_requests").select("*").order("created_at", { ascending: false });
  query = mine ? query.eq("requester_id", actor.id) : query.eq("status", "pending");
  const { data, error } = await query;
  if (error) return json({ error: "status_requests_read_failed" }, { status: 500 });
  const requests = data ?? [];
  if (mine || requests.length === 0) return json({ requests });
  const assetIds = [...new Set(requests.map((row) => row.asset_id))];
  const requesterIds = [...new Set(requests.map((row) => row.requester_id))];
  const [assetsResult, assignmentsResult, requestersResult] = await Promise.all([
    serverSupabase.from("assets").select("id,asset_name,asset_code,status").in("id", assetIds),
    serverSupabase.from("asset_assignments").select("id,asset_id,assignee_id,department_id,status,returned_at").in("asset_id", assetIds).eq("status", "active"),
    serverSupabase.from("staff_users").select("id,full_name").in("id", requesterIds),
  ]);
  if (assetsResult.error || assignmentsResult.error || requestersResult.error) return json({ error: "status_request_labels_failed" }, { status: 500 });
  const currentAssignments = (assignmentsResult.data ?? []).filter((row) => !row.returned_at);
  const assigneeIds = [...new Set(currentAssignments.map((row) => row.assignee_id).filter((id): id is string => Boolean(id)))];
  const departmentIds = [...new Set(currentAssignments.map((row) => row.department_id).filter((id): id is string => Boolean(id)))];
  const [assigneesResult, departmentsResult] = await Promise.all([
    assigneeIds.length ? serverSupabase.from("staff_users").select("id,full_name").in("id", assigneeIds) : Promise.resolve({ data: [], error: null }),
    departmentIds.length ? serverSupabase.from("departments").select("id,name").in("id", departmentIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (assigneesResult.error || departmentsResult.error) return json({ error: "status_request_labels_failed" }, { status: 500 });
  const assets = new Map((assetsResult.data ?? []).map((row) => [row.id, row]));
  const assignments = new Map(currentAssignments.map((row) => [row.asset_id, row]));
  const requesters = new Map((requestersResult.data ?? []).map((row) => [row.id, row.full_name]));
  const assignees = new Map((assigneesResult.data ?? []).map((row) => [row.id, row.full_name]));
  const departments = new Map((departmentsResult.data ?? []).map((row) => [row.id, row.name]));
  return json({ requests: requests.map((row) => {
    const asset = assets.get(row.asset_id);
    const assignment = assignments.get(row.asset_id);
    return {
      ...row,
      asset_name: asset?.asset_name ?? "Tài sản không xác định",
      asset_code: asset?.asset_code ?? null,
      current_status: asset?.status ?? null,
      requester_name: requesters.get(row.requester_id) ?? "Người dùng không xác định",
      assigned_department_name: assignment?.department_id ? departments.get(assignment.department_id) ?? null : null,
      assignee_name: assignment?.assignee_id ? assignees.get(assignment.assignee_id) ?? null : null,
    };
  }) });
}

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return json({ error: "invalid_origin" }, { status: 403 });
  const session = await getSessionUser();
  if (!session) return json({ error: "forbidden" }, { status: 403 });
  const actor = toAssetRepositoryActor(session);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const assetId = typeof body?.asset_id === "string" ? body.asset_id.trim() : "";
  const requestedStatus = body?.requested_status === "broken" ? "broken" : body?.requested_status === "maintenance" ? "maintenance" : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!assetId || !requestedStatus || reason.length < 3) return json({ error: "invalid_request" }, { status: 400 });
  const { data, error } = await serverSupabase.rpc("api_asset_status_request_create", { p_actor_id: actor.id, p_asset_id: assetId, p_requested_status: requestedStatus, p_reason: reason });
  if (error) return json({ error: error.message || "status_request_failed" }, { status: error.code === "42501" ? 403 : error.code === "23505" ? 409 : 400 });
  return json({ request: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!(await isSameOriginRequest())) return json({ error: "invalid_origin" }, { status: 403 });
  const session = await getSessionUser();
  if (!session) return json({ error: "forbidden" }, { status: 403 });
  const actor = toAssetRepositoryActor(session);
  if (!canManageAssets(actor)) return json({ error: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const requestId = typeof body?.request_id === "string" ? body.request_id.trim() : "";
  const decision = body?.decision === "approve" || body?.decision === "reject" ? body.decision : "";
  const reviewNote = typeof body?.review_note === "string" ? body.review_note.trim() : null;
  if (!requestId || !decision) return json({ error: "invalid_review" }, { status: 400 });
  const { data, error } = await serverSupabase.rpc("api_asset_status_request_review", { p_actor_id: actor.id, p_request_id: requestId, p_decision: decision, p_review_note: reviewNote });
  if (error) return json({ error: error.message || "status_review_failed" }, { status: error.code === "42501" ? 403 : error.code === "40001" ? 409 : 400 });
  return json(data);
}
