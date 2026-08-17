import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { logAudit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const json = (body: unknown, init?: ResponseInit) => NextResponse.json(body, {
  ...init,
  headers: { ...NO_STORE_HEADERS, ...(init?.headers ?? {}) },
});

const canView = (roleCode: string) => ["admin", "tong_bien_tap", "tbt_read_only"].includes(roleCode);
const canRename = (roleCode: string) => roleCode === "admin";

type PermissionRow = {
  role_id: string;
  can_manage_users: boolean;
  can_manage_permissions: boolean;
  can_create_task: boolean;
  can_edit_all_tasks: boolean;
  can_comment: boolean;
  roles: { id: string; code: string; name: string; level: number } | null;
};

export async function GET() {
  const actor = await getSessionUser();
  if (!actor || !canView(actor.role_code)) return json({ error: "Bạn không có quyền xem trang phân quyền." }, { status: 403 });
  const { data, error } = await serverSupabase
    .from("role_permissions")
    .select("role_id,can_manage_users,can_manage_permissions,can_create_task,can_edit_all_tasks,can_comment,roles(id,code,name,level)")
    .order("role_id");
  if (error) return json({ error: "Không thể tải dữ liệu phân quyền." }, { status: 500 });
  return json({ permissions: (data ?? []) as unknown as PermissionRow[], can_rename: canRename(actor.role_code) });
}

type Body = { role_id?: unknown; name?: unknown };

const text = (value: unknown) => typeof value === "string" ? value.normalize("NFC").trim().replace(/\s+/gu, " ") : "";

const permissionKeys: PermissionKey[] = ["can_manage_users", "can_manage_permissions", "can_create_task", "can_edit_all_tasks", "can_comment"];
type PermissionKey = "can_manage_users" | "can_manage_permissions" | "can_create_task" | "can_edit_all_tasks" | "can_comment";

export async function PATCH(request: Request) {
  if (!(await isSameOriginRequest())) return json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const actor = await getSessionUser();
  if (!actor || !canRename(actor.role_code)) return json({ error: "Chỉ Quản trị viên được đổi tên vai trò." }, { status: 403 });
  const body = await request.json().catch(() => null) as Body | null;
  const roleId = text(body?.role_id);
  const name = text(body?.name);
  if (!roleId) return json({ error: "Thiếu vai trò." }, { status: 400 });

  const permission = typeof (body as { permission?: unknown } | null)?.permission === "string"
    ? (body as { permission: string }).permission
    : "";
  if (permission) {
    if (name || !permissionKeys.includes(permission as PermissionKey) || typeof (body as { value?: unknown } | null)?.value !== "boolean") {
      return json({ error: "Dữ liệu quyền không hợp lệ." }, { status: 400 });
    }
    const value = (body as { value: boolean }).value;
    const { data: current, error: currentError } = await serverSupabase.from("role_permissions").select("role_id," + permission).eq("role_id", roleId).maybeSingle();
    if (currentError) return json({ error: "Không thể kiểm tra quyền vai trò." }, { status: 500 });
    if (!current) return json({ error: "Không tìm thấy quyền vai trò." }, { status: 404 });
    const { error } = await serverSupabase.from("role_permissions").update({ [permission]: value, updated_at: new Date().toISOString() }).eq("role_id", roleId);
    if (error) return json({ error: "Không thể cập nhật quyền vai trò." }, { status: 500 });
    const oldValue = (current as unknown as Record<string, unknown>)[permission];
    await logAudit({ actorId: actor.id, module: "admin", entityType: "role_permissions", entityId: roleId, action: "update", oldData: { [permission]: oldValue }, newData: { [permission]: value } });
    return json({ permission: { role_id: roleId, field: permission, value } });
  }
  const nameLength = [...name].length;
  if (nameLength < 2 || nameLength > 120) return json({ error: "Tên vai trò phải từ 2 đến 120 ký tự Unicode." }, { status: 400 });

  const { data: before, error: beforeError } = await serverSupabase
    .from("roles")
    .select("id,code,name,level")
    .eq("id", roleId)
    .maybeSingle();
  if (beforeError) return json({ error: "Không thể kiểm tra vai trò." }, { status: 500 });
  if (!before) return json({ error: "Không tìm thấy vai trò." }, { status: 404 });

  const { data, error } = await serverSupabase
    .from("roles")
    .update({ name })
    .eq("id", roleId)
    .select("id,code,name,level")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return json({ error: "Tên vai trò đã tồn tại." }, { status: 400 });
    return json({ error: "Không thể cập nhật tên vai trò." }, { status: 500 });
  }
  if (!data) return json({ error: "Không tìm thấy vai trò." }, { status: 404 });
  await logAudit({
    actorId: actor.id,
    module: "admin",
    entityType: "role",
    entityId: data.id,
    action: "update",
    oldData: { name: before.name },
    newData: { name: data.name },
  });
  return json({ role: data });
}
