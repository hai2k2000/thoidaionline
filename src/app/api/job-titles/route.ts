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
  headers: NO_STORE_HEADERS,
});

const canView = (code: string) => ["admin", "tong_bien_tap", "tbt_read_only"].includes(code);
const isAdmin = (code: string) => code === "admin";
const CANONICAL_JOB_TITLE_CODES = new Set([
  "tong_bien_tap", "pho_tong_bien_tap", "truong_phong", "pho_truong_phong",
  "ke_toan_truong", "phong_vien", "nhan_vien",
]);
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

type Body = { id?: unknown; code?: unknown; name?: unknown; display_order?: unknown; active?: unknown };

export async function GET() {
  const actor = await getSessionUser();
  if (!actor || !canView(actor.role_code)) return json({ error: "Không có quyền." }, { status: 403 });
  const { data, error } = await serverSupabase.from("job_titles").select("id,code,name,display_order,active").order("display_order").order("name");
  if (error) return json({ error: "Không thể tải danh mục chức vụ." }, { status: 500 });
  return json({ job_titles: data ?? [] });
}

export async function POST(request: Request) {
  return mutate(request, "create");
}

export async function PATCH(request: Request) {
  return mutate(request, "update");
}

async function mutate(request: Request, mode: "create" | "update") {
  if (!(await isSameOriginRequest())) return json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const actor = await getSessionUser();
  if (!actor || !isAdmin(actor.role_code)) return json({ error: "Chỉ Admin được thay đổi chức vụ." }, { status: 403 });
  const body = await request.json().catch(() => null) as Body | null;
  const name = text(body?.name).replace(/\s+/g, " ");
  const code = text(body?.code).toLowerCase();
  const order = body?.display_order === undefined ? 100 : Number(body.display_order);
  if (name.length < 2 || name.length > 120) return json({ error: "Tên chức vụ phải từ 2 đến 120 ký tự." }, { status: 400 });
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(code)) return json({ error: "Mã chức vụ chỉ gồm a-z, 0-9, _ hoặc - (2-64 ký tự)." }, { status: 400 });
  if (!Number.isInteger(order) || order < 0 || order > 100000) return json({ error: "Thứ tự không hợp lệ." }, { status: 400 });
  const requestedActive = body?.active === undefined ? true : body.active === true;
  if (requestedActive && !CANONICAL_JOB_TITLE_CODES.has(code)) {
    return json({ error: "Chỉ 7 chức danh chuẩn được phép hoạt động." }, { status: 400 });
  }

  if (mode === "create") {
    const { data, error } = await serverSupabase.from("job_titles").insert({ code, name, display_order: order, active: requestedActive }).select("id,code,name,display_order,active").single();
    if (error) return json({ error: error.code === "23505" ? "Mã hoặc tên chức vụ đã tồn tại." : "Không thể tạo chức vụ." }, { status: 400 });
    await logAudit({ actorId: actor.id, module: "admin", entityType: "job_title", entityId: data.id, action: "create", newData: { code: data.code, name: data.name, display_order: data.display_order, active: data.active } });
    return json({ job_title: data }, { status: 201 });
  }

  const id = text(body?.id);
  if (!id) return json({ error: "Thiếu chức vụ." }, { status: 400 });
  if (body?.active !== undefined && typeof body.active !== "boolean") return json({ error: "Trạng thái không hợp lệ." }, { status: 400 });
  const { data: before } = await serverSupabase.from("job_titles").select("id,code,name,display_order,active").eq("id", id).maybeSingle();
  if (!before) return json({ error: "Không tìm thấy chức vụ." }, { status: 404 });
  const patch = { code, name, display_order: order, ...(body?.active === undefined ? {} : { active: body.active }) };
  const { data, error } = await serverSupabase.from("job_titles").update(patch).eq("id", id).select("id,code,name,display_order,active").maybeSingle();
  if (error) return json({ error: error.code === "23505" ? "Mã hoặc tên chức vụ đã tồn tại." : "Không thể cập nhật chức vụ." }, { status: 400 });
  if (!data) return json({ error: "Không tìm thấy chức vụ." }, { status: 404 });
  await logAudit({ actorId: actor.id, module: "admin", entityType: "job_title", entityId: data.id, action: "update", oldData: { code: before.code, name: before.name, display_order: before.display_order, active: before.active }, newData: { code: data.code, name: data.name, display_order: data.display_order, active: data.active } });
  return json({ job_title: data });
}
