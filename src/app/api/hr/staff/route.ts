import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/serverSession";
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

const canViewAllStaff = (roleCode: string, canEditAllTasks: boolean) =>
  canEditAllTasks || [
    "admin",
    "tong_bien_tap",
    "tbt_read_only",
    "pho_tong_bien_tap",
    "phu_trach_phong_tri_su",
    "phu_trach_phong_phong_vien",
    "phu_trach_phong_bien_tap",
  ].includes(roleCode);

export async function GET(request: Request) {
  const actor = await getSessionUser();
  if (!actor) return json({ error: "Không có quyền." }, { status: 403 });

  const requestedUserId = new URL(request.url).searchParams.get("user_id")?.trim() ?? "";
  const canViewAll = canViewAllStaff(actor.role_code, actor.permissions.can_edit_all_tasks);
  if (requestedUserId && requestedUserId !== actor.id && !canViewAll) {
    return json({ error: "Không có quyền xem nhân sự này." }, { status: 403 });
  }

  let query = serverSupabase
    .from("staff_users")
    .select("id,full_name,username,email,active,list_order,role_id,job_title_id,department_id,roles(code,name,level),job_titles(id,code,name,display_order,active),departments(code,name)");

  if (requestedUserId) query = query.eq("id", requestedUserId);
  else if (!canViewAll) query = query.eq("id", actor.id);
  else query = query.eq("active", true);

  const { data, error } = await query;
  if (error) return json({ error: "Không thể tải dữ liệu nhân sự." }, { status: 500 });
  return json({ users: sortStaffRows(data ?? []) });
}
