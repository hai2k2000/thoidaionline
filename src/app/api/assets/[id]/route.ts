import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { logServerAudit } from "@/lib/serverAudit";

const NO_STORE = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };
const json = (body: unknown, init?: ResponseInit) => NextResponse.json(body, { ...init, headers: NO_STORE });
const canManage = (actor: { role_code: string; permissions: { can_edit_all_tasks: boolean } }) => actor.role_code === "admin" || actor.permissions.can_edit_all_tasks;
const canAccess = (roleCode: string) => roleCode !== "tbt_read_only" && roleCode !== "tong_bien_tap";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getSessionUser();
  if (!actor) return json({ error: "unauthenticated" }, { status: 401 });
  if (!canAccess(actor.role_code)) return json({ error: "forbidden" }, { status: 403 });
  const id = (await context.params).id;
  const [{ data: asset, error }, { data: assignment, error: assignmentError }] = await Promise.all([
    serverSupabase.from("assets").select("*").eq("id", id).maybeSingle(),
    serverSupabase.from("asset_assignments").select("id").eq("asset_id", id).eq("assignee_id", actor.id).eq("status", "active").is("returned_at", null).limit(1).maybeSingle(),
  ]);
  if (error || assignmentError) return json({ error: "Không thể tải tài sản." }, { status: 500 });
  if (!asset) return json({ error: "not_found" }, { status: 404 });
  if (!canManage(actor) && !assignment) return json({ error: "forbidden" }, { status: 403 });
  return json({ asset });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isSameOriginRequest())) return json({ error: "invalid_origin" }, { status: 403 });
  const actor = await getSessionUser();
  if (!actor || !canManage(actor)) return json({ error: "forbidden" }, { status: 403 });
  const id = (await context.params).id;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const patch: Record<string, string | null> = {};
  for (const key of ["asset_name", "category", "serial_number", "note", "status"] as const) {
    if (Object.prototype.hasOwnProperty.call(body ?? {}, key)) {
      if (typeof body?.[key] !== "string") return json({ error: "invalid_request" }, { status: 400 });
      patch[key] = body[key] as string;
    }
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
