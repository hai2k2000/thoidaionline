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

export async function GET(request: Request) {
  const sessionActor = await getSessionUser();
  if (!sessionActor) return json({ error: "unauthenticated" }, { status: 401 });
  const actor = toAssetRepositoryActor(sessionActor);
  const result = await repository.listAssetsForActor(actor);
  if (!result.ok) return json({ error: result.error }, { status: result.error === "forbidden" ? 403 : 500 });
  const response: Record<string, unknown> = result.data;
  if (new URL(request.url).searchParams.get("options") === "1") {
    if (!canManageAssets(actor)) return json({ error: "forbidden" }, { status: 403 });
    const [users, departments] = await Promise.all([
      serverSupabase.from("staff_users").select("id,full_name,username,active").eq("active", true).order("full_name"),
      serverSupabase.from("departments").select("id,name,active").eq("active", true).order("name"),
    ]);
    if (users.error || departments.error) return json({ error: "asset_options_failed" }, { status: 500 });
    response.users = users.data ?? [];
    response.departments = departments.data ?? [];
  }
  return json(response);
}

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return json({ error: "invalid_origin" }, { status: 403 });
  const sessionActor = await getSessionUser();
  if (!sessionActor) return json({ error: "forbidden" }, { status: 403 });
  const actor = toAssetRepositoryActor(sessionActor);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "create";
  const assetId = typeof body?.asset_id === "string" ? body.asset_id.trim() : "";
  const lifecycleInput = {
    asset_id: assetId,
    department_id: typeof body?.department_id === "string" ? body.department_id : null,
    assignee_id: typeof body?.assignee_id === "string" ? body.assignee_id : null,
    expected_return_at: typeof body?.expected_return_at === "string" ? body.expected_return_at : null,
    handover_note: typeof body?.handover_note === "string" ? body.handover_note : null,
  };
  if (action === "assign" || action === "transfer") {
    const result = action === "assign" ? await repository.assignAssetForActor(actor, lifecycleInput) : await repository.transferAssetForActor(actor, lifecycleInput);
    if (!result.ok) return json({ error: result.error }, { status: result.error === "forbidden" ? 403 : 400 });
    await logServerAudit({ actorId: actor.id, module: "assets", entityType: "asset_assignments", entityId: assetId, action, newData: result.data });
    return json(result.data, { status: 201 });
  }
  if (action === "return") {
    const result = await repository.returnAssetForActor(actor, { asset_id: assetId, return_note: typeof body?.return_note === "string" ? body.return_note : null });
    if (!result.ok) return json({ error: result.error }, { status: result.error === "forbidden" ? 403 : 400 });
    await logServerAudit({ actorId: actor.id, module: "assets", entityType: "asset_assignments", entityId: assetId, action: "return", newData: result.data });
    return json(result.data);
  }
  const result = await repository.createAssetForActor(actor, {
    asset_code: typeof body?.asset_code === "string" ? body.asset_code : null,
    asset_name: typeof body?.asset_name === "string" ? body.asset_name : "",
    category: typeof body?.category === "string" ? body.category : "",
    serial_number: typeof body?.serial_number === "string" ? body.serial_number : null,
    status: typeof body?.status === "string" ? body.status : "available",
    note: typeof body?.note === "string" ? body.note : null,
  });
  if (!result.ok) return json({ error: result.error }, { status: result.error === "forbidden" ? 403 : 400 });
  const asset = result.data as { id?: string };
  await logServerAudit({ actorId: actor.id, module: "assets", entityType: "assets", entityId: asset.id, action: "create", newData: result.data });
  return json({ asset: result.data }, { status: 201 });
}
