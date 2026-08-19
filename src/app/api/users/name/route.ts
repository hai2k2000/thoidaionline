import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 120;
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*[\p{L}\p{M}]$/u;

type Body = { userId?: unknown; fullName?: unknown };

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const actor = await getSessionUser();
  if (!actor || actor.role_code !== "admin") return NextResponse.json({ error: "Chỉ Admin được cập nhật thông tin nhân sự." }, { status: 403 });
  const body = await request.json().catch(() => null) as Body | null;
  if (typeof body?.userId !== "string" || !body.userId.trim()) return NextResponse.json({ error: "Thiếu user." }, { status: 400 });
  if (typeof body.fullName !== "string") return NextResponse.json({ error: "Tên phải là chuỗi ký tự." }, { status: 400 });
  const fullName = body.fullName.trim().replace(/\s+/g, " ");
  if (fullName.length < MIN_NAME_LENGTH || fullName.length > MAX_NAME_LENGTH || !NAME_PATTERN.test(fullName) || !/[\p{L}]/u.test(fullName)) return NextResponse.json({ error: "Tên không hợp lệ." }, { status: 400 });
  const { data: target } = await serverSupabase.from("staff_users").select("id,full_name").eq("id", body.userId).maybeSingle();
  if (!target) return NextResponse.json({ error: "Không tìm thấy user." }, { status: 404 });
  if (target.full_name === fullName) return NextResponse.json({ ok: true, changed: false });
  const { error } = await serverSupabase.from("staff_users").update({ full_name: fullName }).eq("id", body.userId);
  if (error) return NextResponse.json({ error: "Không thể cập nhật tên user." }, { status: 500 });
  await serverSupabase.from("audit_logs").insert({ actor_id: actor.id, module: "hr", entity_type: "staff_user", entity_id: body.userId, action: "update", old_data: { field: "full_name", length: target.full_name.length }, new_data: { field: "full_name", length: fullName.length } });
  return NextResponse.json({ ok: true, changed: true });
}
