import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { logServerAudit } from "@/lib/serverAudit";

const NO_STORE = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };
const json = (body: unknown, init?: ResponseInit) => NextResponse.json(body, { ...init, headers: NO_STORE });
const canManage = (actor: { role_code: string; permissions: { can_manage_assets: boolean } }) => actor.permissions.can_manage_assets === true;
const canAccess = (actor: { role_code: string; permissions: { can_view_assets: boolean } }) => actor.permissions.can_view_assets === true;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getSessionUser();
  if (!actor) return json({ error: "unauthenticated" }, { status: 401 });
  if (!canAccess(actor)) return json({ error: "forbidden" }, { status: 403 });
  const id = (await context.params).id;
  const [{ data: asset, error }, { data: assignments, error: assignmentError }] = await Promise.all([
    serverSupabase.from("assets").select("*").eq("id", id).maybeSingle(),
    serverSupabase.from("asset_assignments").select("id,assignee_id,department_id").eq("asset_id", id).eq("status", "active").is("returned_at", null),
  ]);
  if (error || assignmentError) return json({ error: "Không thể tải tài sản." }, { status: 500 });
  if (!asset) return json({ error: "not_found" }, { status: 404 });
  const assignment = (assignments ?? []).find((item) => item.assignee_id === actor.id || item.department_id === actor.department_id);
  if (!canManage(actor) && !assignment) return json({ error: "forbidden" }, { status: 403 });
  return json({ asset });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isSameOriginRequest())) return json({ error: "invalid_origin" }, { status: 403 });
  const actor = await getSessionUser();
  if (!actor || !canManage(actor)) return json({ error: "forbidden" }, { status: 403 });
  const id = (await context.params).id;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const patch: Record<string, string | number | null> = {};
  for (const key of ["asset_name", "category", "serial_number", "note", "status"] as const) {
    if (Object.prototype.hasOwnProperty.call(body ?? {}, key)) {
      if (typeof body?.[key] !== "string") return json({ error: "invalid_request" }, { status: 400 });
      patch[key] = body[key] as string;
    }
  }
  if (Object.prototype.hasOwnProperty.call(body ?? {}, "tracking_mode") || Object.prototype.hasOwnProperty.call(body ?? {}, "quantity")) {
    const trackingMode = body?.tracking_mode === "lot" ? "lot" : body?.tracking_mode === "individual" ? "individual" : null;
    const quantity = typeof body?.quantity === "number" ? body.quantity : null;
    if (!trackingMode || quantity === null || !Number.isInteger(quantity) || quantity < 1 || (trackingMode === "individual" && quantity !== 1)) return json({ error: "invalid_tracking_quantity" }, { status: 400 });
    patch.tracking_mode = trackingMode;
    patch.quantity = quantity;
  }
  if (typeof patch.asset_name === "string" && !patch.asset_name.trim()) return json({ error: "invalid_request" }, { status: 400 });
  if (typeof patch.category === "string" && !patch.category.trim()) return json({ error: "invalid_request" }, { status: 400 });
  if (typeof patch.status === "string" && !["available", "in_use", "maintenance", "broken", "liquidated"].includes(patch.status)) return json({ error: "invalid_request" }, { status: 400 });
  if (!Object.keys(patch).length) return json({ error: "invalid_request" }, { status: 400 });
  Object.keys(patch).forEach((key) => { if (patch[key] === "") patch[key] = null; });
  const { data, error } = await serverSupabase.from("assets").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").maybeSingle();
  if (error) return json({ error: "Không thể cập nhật tài sản." }, { status: 400 });
  if (!data) return json({ error: "not_found" }, { status: 404 });
  await logServerAudit({ actorId: actor.id, module: "admin", entityType: "assets", entityId: id, action: "update", newData: data });
  return json({ asset: data });
}
