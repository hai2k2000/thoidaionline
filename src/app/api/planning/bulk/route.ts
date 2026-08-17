import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";

type Item = { title?: unknown };
type Body = { planPeriod?: unknown; dueDate?: unknown; reviewerId?: unknown; description?: unknown; items?: unknown; batchId?: unknown };
const PLAN_CREATOR_ROLES = new Set(["admin", "pho_tong_bien_tap", "phu_trach_phong_tri_su", "phu_trach_phong_phong_vien", "phu_trach_phong_bien_tap"]);

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ." }, { status: 401 });
  if (!PLAN_CREATOR_ROLES.has(user.role_code)) {
    return NextResponse.json({ error: "Bạn không có quyền lập kế hoạch." }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as Body | null;
  const items = Array.isArray(body?.items) ? body.items as Item[] : [];
  const planPeriod = typeof body?.planPeriod === "string" ? body.planPeriod : "";
  const dueDate = typeof body?.dueDate === "string" ? body.dueDate : "";
  const reviewerId = typeof body?.reviewerId === "string" ? body.reviewerId : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const batchId = typeof body?.batchId === "string" && /^[0-9a-f-]{36}$/i.test(body.batchId) ? body.batchId : randomUUID();
  if (!["daily", "weekly"].includes(planPeriod) || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !reviewerId || !description || items.length < 1 || items.length > 100) {
    return NextResponse.json({ error: "Kỳ, deadline, mô tả, người nhận báo cáo và danh sách việc là bắt buộc." }, { status: 400 });
  }
  const normalizedItems = items.map((item) => ({ title: typeof item?.title === "string" ? item.title.trim() : "" }));
  if (normalizedItems.some((item) => !item.title || item.title.length > 500)) {
    return NextResponse.json({ error: "Tên mỗi việc phải từ 1 đến 500 ký tự." }, { status: 400 });
  }
  const { data, error } = await serverSupabase.rpc("create_bulk_task_plan", {
    p_actor_id: user.id,
    p_plan_period: planPeriod,
    p_due_date: dueDate,
    p_reviewer_id: reviewerId,
    p_description: description,
    p_items: normalizedItems,
    p_batch_id: batchId,
  });
  if (error) {
    const status = error.code === "42501" ? 403 : ["22023", "22007"].includes(error.code ?? "") ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ ok: true, batchId, tasks: data ?? [] });
}
