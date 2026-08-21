import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { validateEmail, validatePhone } from "@/lib/userContactValidation";
const json = (body: unknown, status=200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function PATCH(request: Request) {
  if (!(await isSameOriginRequest())) return json({ error: "Yêu cầu không hợp lệ." }, 403);
  const actor = await getSessionUser(); if (!actor) return json({ error: "Phiên đăng nhập không hợp lệ." }, 401);
  const body = await request.json().catch(() => null) as { fullName?: unknown; email?: unknown; phone?: unknown } | null;
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const email = validateEmail(body?.email); const phone = validatePhone(body?.phone);
  if (fullName.length < 2 || fullName.length > 120) return json({ error: "Họ tên không hợp lệ." }, 400);
  if (body?.email && !email) return json({ error: "Email không hợp lệ." }, 400);
  if (body?.phone && !phone) return json({ error: "Số điện thoại không hợp lệ." }, 400);
  const { error } = await serverSupabase.from("staff_users").update({ full_name: fullName, email, phone }).eq("id", actor.id).eq("active", true);
  return error ? json({ error: "Không thể cập nhật thông tin cá nhân." }, 500) : json({ ok: true, message: "Đã cập nhật thông tin cá nhân." });
}
