import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { sortStaffRows } from "@/lib/staffOrdering";

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

const canViewUsers = (roleCode: string) => ["admin", "tong_bien_tap", "tbt_read_only"].includes(roleCode);
const canEditUsers = (roleCode: string) => roleCode === "admin";

export async function GET() {
  const actor = await getSessionUser();
  if (!actor || !canViewUsers(actor.role_code)) return json({ error: "Không có quyền." }, { status: 403 });
  const [roles, departments, jobTitles, users] = await Promise.all([
    serverSupabase.from("roles").select("id,code,name,level").order("level", { ascending: false }),
    serverSupabase.from("departments").select("id,code,name,active").order("name"),
    serverSupabase.from("job_titles").select("id,code,name,display_order,active").order("display_order").order("name"),
    serverSupabase.from("staff_users").select("id,full_name,username,email,role_id,job_title_id,department_id,active,list_order,roles(code,name,level),job_titles(code,name,display_order,active),departments!staff_users_department_id_fkey(code,name)"),
  ]);
  const error = roles.error || departments.error || jobTitles.error || users.error;
  if (error) return json({ error: "Không thể tải dữ liệu nhân sự." }, { status: 500 });
  return json({
    roles: roles.data ?? [],
    departments: departments.data ?? [],
    job_titles: jobTitles.data ?? [],
    users: sortStaffRows(users.data ?? []),
  });
}

type Body = {
  full_name?: unknown;
  username?: unknown;
  role_id?: unknown;
  job_title_id?: unknown;
  department_id?: unknown;
  active?: unknown;
  user_id?: unknown;
};

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

export async function POST(request: Request) {
  return mutate(request, "create");
}

export async function PATCH(request: Request) {
  return mutate(request, "update");
}

async function mutate(request: Request, mode: "create" | "update") {
  if (!(await isSameOriginRequest())) return json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const actor = await getSessionUser();
  if (!actor || !canEditUsers(actor.role_code)) return json({ error: "Chỉ Admin được thay đổi nhân sự." }, { status: 403 });
  const body = await request.json().catch(() => null) as Body | null;

  if (mode === "create") {
    const fullName = text(body?.full_name);
    const username = text(body?.username).toLowerCase();
    const roleId = text(body?.role_id);
    const jobTitleId = text(body?.job_title_id);
    const departmentId = text(body?.department_id);
    if (fullName.length < 2 || !username || !roleId || !jobTitleId || !departmentId) return json({ error: "Thiếu dữ liệu user." }, { status: 400 });
    const { data: jobTitle, error: jobTitleError } = await serverSupabase.from("job_titles").select("id,active").eq("id", jobTitleId).maybeSingle();
    if (jobTitleError) return json({ error: "Không thể kiểm tra chức vụ." }, { status: 500 });
    if (!jobTitle) return json({ error: "Chức vụ không tồn tại." }, { status: 400 });
    if (!jobTitle.active) return json({ error: "Không thể gán chức vụ đã ngừng sử dụng." }, { status: 400 });
    const { data, error } = await serverSupabase.from("staff_users").insert({
      full_name: fullName,
      username,
      role_id: roleId,
      job_title_id: jobTitleId,
      department_id: departmentId,
      active: true,
      password: "123456",
    }).select("id,full_name,username,role_id,job_title_id,department_id,active").single();
    if (error) return json({ error: "Không thể tạo user." }, { status: 500 });
    return json({ user: data }, { status: 201 });
  }

  const userId = text(body?.user_id);
  if (!userId) return json({ error: "Thiếu user." }, { status: 400 });
  const { data: currentUser, error: currentUserError } = await serverSupabase
    .from("staff_users")
    .select("id,job_title_id")
    .eq("id", userId)
    .maybeSingle();
  if (currentUserError) return json({ error: "Không thể kiểm tra user." }, { status: 500 });
  if (!currentUser) return json({ error: "Không tìm thấy user." }, { status: 404 });
  const patch: Record<string, string | boolean> = {};
  if (body && Object.prototype.hasOwnProperty.call(body, "full_name")) {
    const fullName = text(body.full_name);
    if (fullName.length < 2 || fullName.length > 120) return json({ error: "Tên không hợp lệ." }, { status: 400 });
    patch.full_name = fullName.replace(/\s+/g, " ");
  }
  if (body && Object.prototype.hasOwnProperty.call(body, "role_id")) {
    const roleId = text(body.role_id);
    if (!roleId) return json({ error: "Role quyền không hợp lệ." }, { status: 400 });
    patch.role_id = roleId;
  }
  if (body && Object.prototype.hasOwnProperty.call(body, "job_title_id")) {
    const jobTitleId = text(body.job_title_id);
    if (!jobTitleId) return json({ error: "Chức vụ không hợp lệ." }, { status: 400 });
    const { data: jobTitle, error: jobTitleError } = await serverSupabase.from("job_titles").select("id,active").eq("id", jobTitleId).maybeSingle();
    if (jobTitleError) return json({ error: "Không thể kiểm tra chức vụ." }, { status: 500 });
    if (!jobTitle) return json({ error: "Chức vụ không tồn tại." }, { status: 400 });
    if (!jobTitle.active && currentUser.job_title_id !== jobTitleId) return json({ error: "Không thể gán chức vụ đã ngừng sử dụng." }, { status: 400 });
    patch.job_title_id = jobTitleId;
  }
  if (body && Object.prototype.hasOwnProperty.call(body, "department_id")) {
    const departmentId = text(body.department_id);
    if (!departmentId) return json({ error: "Phòng ban không hợp lệ." }, { status: 400 });
    patch.department_id = departmentId;
  }
  if (body && Object.prototype.hasOwnProperty.call(body, "active")) {
    if (typeof body.active !== "boolean") return json({ error: "Trạng thái không hợp lệ." }, { status: 400 });
    patch.active = body.active;
  }
  if (!Object.keys(patch).length) return json({ error: "Không có trường được phép cập nhật." }, { status: 400 });
  const { data, error } = await serverSupabase.from("staff_users").update(patch).eq("id", userId).select("id,full_name,username,role_id,job_title_id,department_id,active").maybeSingle();
  if (error) return json({ error: "Không thể cập nhật user." }, { status: 500 });
  if (!data) return json({ error: "Không tìm thấy user." }, { status: 404 });
  return json({ user: data });
}
