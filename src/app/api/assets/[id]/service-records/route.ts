import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { createAssetRepository, type AssetServiceRecordInput } from "@/lib/assetRepository";
import { toAssetRepositoryActor } from "@/lib/assetApiActor";
import { canManageAssets } from "@/lib/assetAuthorization";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const NO_STORE = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };
const json = (body: unknown, init?: ResponseInit) => NextResponse.json(body, { ...init, headers: NO_STORE });
const repository = createAssetRepository(serverSupabase);
const types = new Set(["maintenance", "repair", "replacement"]);
const statuses = new Set(["planned", "in_progress", "completed", "cancelled"]);
const conditions = new Set(["normal", "needs_maintenance", "under_service", "broken"]);

function parseBody(body: Record<string, unknown> | null, assetId: string): AssetServiceRecordInput | null {
  const serviceType = typeof body?.service_type === "string" ? body.service_type : "";
  const serviceStatus = typeof body?.service_status === "string" ? body.service_status : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const cost = body?.cost === null || body?.cost === undefined || body?.cost === "" ? null : Number(body.cost);
  const conditionAfter = body?.condition_after === null || body?.condition_after === "" || body?.condition_after === undefined ? null : body.condition_after;
  if (!types.has(serviceType) || !statuses.has(serviceStatus) || description.length < 3 || description.length > 4000) return null;
  if (cost !== null && (!Number.isFinite(cost) || cost < 0)) return null;
  if (conditionAfter !== null && (typeof conditionAfter !== "string" || !conditions.has(conditionAfter))) return null;
  return {
    asset_id: assetId, service_type: serviceType as AssetServiceRecordInput["service_type"],
    service_status: serviceStatus as AssetServiceRecordInput["service_status"], description,
    service_provider: typeof body?.service_provider === "string" ? body.service_provider.trim() || null : null,
    cost, started_at: typeof body?.started_at === "string" ? body.started_at : null,
    completed_at: typeof body?.completed_at === "string" ? body.completed_at : null,
    condition_before: null, condition_after: conditionAfter as AssetServiceRecordInput["condition_after"],
    result_note: typeof body?.result_note === "string" ? body.result_note.trim() || null : null,
  };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return json({ error: "unauthenticated" }, { status: 401 });
  const actor = toAssetRepositoryActor(session);
  const id = (await context.params).id;
  const asset = await repository.getAssetForActor(actor, id);
  if (!asset.ok) return json({ error: asset.error }, { status: asset.error === "asset_not_found" ? 404 : 403 });
  return json({ records: asset.data.serviceRecords ?? [] });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isSameOriginRequest())) return json({ error: "invalid_origin" }, { status: 403 });
  const session = await getSessionUser();
  if (!session) return json({ error: "forbidden" }, { status: 403 });
  const actor = toAssetRepositoryActor(session);
  if (!canManageAssets(actor)) return json({ error: "forbidden" }, { status: 403 });
  const id = (await context.params).id;
  const input = parseBody(await request.json().catch(() => null), id);
  if (!input) return json({ error: "invalid_service_record" }, { status: 400 });
  const result = await repository.createServiceRecordForActor(actor, input);
  if (!result.ok) return json({ error: result.error }, { status: result.error === "forbidden" ? 403 : result.error === "asset_not_found" ? 404 : 400 });
  return json({ record: result.data }, { status: 201 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isSameOriginRequest())) return json({ error: "invalid_origin" }, { status: 403 });
  const session = await getSessionUser();
  if (!session) return json({ error: "forbidden" }, { status: 403 });
  const actor = toAssetRepositoryActor(session);
  if (!canManageAssets(actor)) return json({ error: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const recordId = typeof body?.record_id === "string" ? body.record_id.trim() : "";
  if (!recordId) return json({ error: "invalid_service_record" }, { status: 400 });
  const input = parseBody(body, (await context.params).id);
  if (!input) return json({ error: "invalid_service_record" }, { status: 400 });
  const result = await repository.updateServiceRecordForActor(actor, recordId, input);
  if (!result.ok) return json({ error: result.error }, { status: result.error === "forbidden" ? 403 : result.error === "service_record_not_found" ? 404 : 400 });
  return json({ record: result.data });
}
