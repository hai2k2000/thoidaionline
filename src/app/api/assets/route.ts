import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { logServerAudit } from "@/lib/serverAudit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };
const json = (body: unknown, init?: ResponseInit) => NextResponse.json(body, { ...init, headers: NO_STORE });
const canManage = (actor: { role_code: string; permissions: { can_edit_all_tasks: boolean } }) =>
  actor.role_code !== "tbt_read_only" && actor.role_code !== "tong_bien_tap"
    && (actor.role_code === "admin" || actor.permissions.can_edit_all_tasks);
const canAccess = (roleCode: string) => roleCode !== "tbt_read_only" && roleCode !== "tong_bien_tap";

export async function GET(request: Request) {
  const actor = await getSessionUser();
  if (!actor) return json({ error: "unauthenticated" }, { status: 401 });
  if (!canAccess(actor.role_code)) return json({ error: "forbidden" }, { status: 403 });
  const options = new URL(request.url).searchParams.get("options") === "1";
  const [assets, assignments, users, departments] = await Promise.all([
    serverSupabase.from("assets").select("*").order("created_at", { ascending: false }),
    serverSupabase.from("asset_assignments").select("asset_id,assignee_id,department_id,status,returned_at"),
    serverSupabase.from("staff_users").select("id,full_name,active").eq("active", true),
    serverSupabase.from("departments").select("id,name,active").eq("active", true),
  ]);
  if (assets.error || assignments.error || users.error || departments.error) return json({ error: "Không thể tải dữ liệu tài sản." }, { status: 500 });

  let assetRows = assets.data ?? [];
  const activeAssignments = (assignments.data ?? []).filter((row) => row.status === "active" && !row.returned_at);
  if (!canManage(actor)) {
    const ownIds = new Set(activeAssignments.filter((row) => row.assignee_id === actor.id).map((row) => row.asset_id));
    assetRows = assetRows.filter((row) => ownIds.has(row.id));
  }

  const userMap = new Map((users.data ?? []).map((row) => [row.id, row.full_name]));
  const departmentMap = new Map((departments.data ?? []).map((row) => [row.id, row.name]));
  const assignmentsForResponse = canManage(actor) ? assignments.data ?? [] : activeAssignments.filter((row) => row.assignee_id === actor.id);
  const labels = new Map<string, string>();
  assignmentsForResponse.filter((row) => row.status === "active" && !row.returned_at).forEach((row) => {
    labels.set(row.asset_id, row.assignee_id ? userMap.get(row.assignee_id) ?? "-" : row.department_id ? `Phòng ban: ${departmentMap.get(row.department_id) ?? "-"}` : "-");
  });
  const labeledAssets = assetRows.map((row) => ({ ...row, assigned_to_label: labels.get(row.id) ?? "-" }));
  const response: Record<string, unknown> = { assets: labeledAssets, assignments: assignmentsForResponse };
  if (options) {
    if (!canManage(actor)) return json({ error: "forbidden" }, { status: 403 });
    const [optionUsers, optionDepartments] = await Promise.all([
      serverSupabase.from("staff_users").select("id,full_name,username,active").eq("active", true).order("full_name"),
      serverSupabase.from("departments").select("id,name,active").eq("active", true).order("name"),
    ]);
    if (optionUsers.error || optionDepartments.error) return json({ error: "Không thể tải danh mục tài sản." }, { status: 500 });
    response.users = optionUsers.data ?? [];
    response.departments = optionDepartments.data ?? [];
  }
  return json(response);
}

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return json({ error: "invalid_origin" }, { status: 403 });
  const actor = await getSessionUser();
  if (!actor || !canManage(actor)) return json({ error: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "create";
  if (action === "assign") {
    const assetId = typeof body?.asset_id === "string" ? body.asset_id.trim() : "";
    const assigneeId = typeof body?.assignee_id === "string" ? body.assignee_id.trim() : "";
    const departmentId = typeof body?.department_id === "string" ? body.department_id.trim() : "";
    if (!assetId || (!assigneeId && !departmentId) || (assigneeId && departmentId)) return json({ error: "invalid_request" }, { status: 400 });
    const { data, error } = await serverSupabase.from("asset_assignments").insert({
      asset_id: assetId, assignee_id: assigneeId || null, department_id: departmentId || null, status: "active", created_by: actor.id,
    }).select("*").single();
    if (error) return json({ error: "Không thể cấp phát tài sản." }, { status: 400 });
    const { error: assetError } = await serverSupabase.from("assets").update({ status: "in_use", updated_at: new Date().toISOString() }).eq("id", assetId);
    if (assetError) return json({ error: "Tài sản đã cấp phát nhưng chưa cập nhật trạng thái." }, { status: 500 });
    await logServerAudit({ actorId: actor.id, module: "admin", entityType: "asset_assignments", entityId: data.id, action: "assign", newData: data });
    return json({ assignment: data }, { status: 201 });
  }
  const assetName = typeof body?.asset_name === "string" ? body.asset_name.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";
  if (!assetName || assetName.length > 200 || !category || category.length > 120) return json({ error: "invalid_request" }, { status: 400 });
  const status = typeof body?.status === "string" ? body.status : "available";
  if (!["available", "in_use", "maintenance", "broken", "liquidated"].includes(status)) return json({ error: "invalid_request" }, { status: 400 });
  const year = new Date().getFullYear();
  const prefix = `TS-${year}-`;
  const { data: latest } = await serverSupabase.from("assets").select("asset_code").ilike("asset_code", `${prefix}%`).order("asset_code", { ascending: false }).limit(1).maybeSingle();
  const requestedCode = typeof body?.asset_code === "string" ? body.asset_code.trim().toUpperCase() : "";
  const current = latest?.asset_code ?? `${prefix}0000`;
  const nextCode = `${prefix}${String(Number((current.split("-")[2] ?? "0").replace(/\D/g, "")) + 1).padStart(4, "0")}`;
  const { data, error } = await serverSupabase.from("assets").insert({
    asset_code: requestedCode || nextCode, asset_name: assetName, category, serial_number: typeof body?.serial_number === "string" ? body.serial_number.trim() || null : null,
    status, note: typeof body?.note === "string" ? body.note.trim() || null : null,
  }).select("*").single();
  if (error) return json({ error: "Không thể tạo tài sản." }, { status: 400 });
  await logServerAudit({ actorId: actor.id, module: "admin", entityType: "assets", entityId: data.id, action: "create", newData: data });
  return json({ asset: data }, { status: 201 });
}
