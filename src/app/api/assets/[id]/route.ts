import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { createAssetRepository } from "@/lib/assetRepository";
import { toAssetRepositoryActor } from "@/lib/assetApiActor";
import { canManageAssets } from "@/lib/assetAuthorization";
import { logServerAudit } from "@/lib/serverAudit";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const NO_STORE = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };
const json = (body: unknown, init?: ResponseInit) => NextResponse.json(body, { ...init, headers: NO_STORE });
const repository = createAssetRepository(serverSupabase);

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const sessionActor = await getSessionUser();
  if (!sessionActor) return json({ error: "unauthenticated" }, { status: 401 });
  const asset = await repository.getAssetForActor(toAssetRepositoryActor(sessionActor), (await context.params).id);
  if (!asset.ok) return json({ error: asset.error }, { status: asset.error === "asset_not_found" ? 404 : 403 });
  return json({ asset: asset.data });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isSameOriginRequest())) return json({ error: "invalid_origin" }, { status: 403 });
  const sessionActor = await getSessionUser();
  if (!sessionActor) return json({ error: "forbidden" }, { status: 403 });
  const actor = toAssetRepositoryActor(sessionActor);
  if (!canManageAssets(actor)) return json({ error: "forbidden" }, { status: 403 });
  const id = (await context.params).id;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const result = await repository.updateAssetForActor(actor, id, {
    asset_name: typeof body?.asset_name === "string" ? body.asset_name : undefined,
    category: typeof body?.category === "string" ? body.category : undefined,
    serial_number: typeof body?.serial_number === "string" ? body.serial_number : null,
    status: typeof body?.status === "string" ? body.status : undefined,
    note: typeof body?.note === "string" ? body.note : null,
  });
  if (!result.ok) return json({ error: result.error }, { status: result.error === "asset_not_found" ? 404 : 400 });
  await logServerAudit({ actorId: actor.id, module: "assets", entityType: "assets", entityId: id, action: "update", newData: result.data });
  return json({ asset: result.data });
}
