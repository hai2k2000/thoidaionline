import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { toAssetRepositoryActor } from "@/lib/assetApiActor";
import { canManageAssets } from "@/lib/assetAuthorization";
import { logServerAudit } from "@/lib/serverAudit";

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
  return json({ requests: data ?? [] });
}

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return json({ error: "invalid_origin" }, { status: 403 });
  const session = await getSessionUser();
  if (!session) return json({ error: "forbidden" }, { status: 403 });
  const actor = toAssetRepositoryActor(session);
  if (!actor.rbacPermissions.includes("asset.view") && !canManageAssets(actor)) return json({ error: "forbidden" }, { status: 403 });
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
  await logServerAudit({ actorId: actor.id, module: "assets", entityType: "asset_status_change_requests", entityId: requestId, action: decision === "approve" ? "status_change_approved" : "status_change_rejected", newData: data });
  return json(data);
}
