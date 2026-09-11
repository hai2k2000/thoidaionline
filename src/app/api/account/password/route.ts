import { NextResponse } from "next/server";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getPasswordPolicyError } from "@/lib/passwordPolicy";
import { DEFAULT_FIRST_LOGIN_PASSWORD } from "@/lib/defaultPassword";
const json = (body: unknown, status=200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function PATCH(request: Request) {
  if (!(await isSameOriginRequest())) return json({ error: "Yêu cầu không hợp lệ." }, 403);
  const actor = await getSessionUser(); if (!actor) return json({ error: "Phiên đăng nhập không hợp lệ." }, 401);
  const body = await request.json().catch(() => null) as { currentPassword?: unknown; newPassword?: unknown; confirmPassword?: unknown } | null;
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  const confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : "";
  if (!currentPassword || newPassword !== confirmPassword) return json({ error: "Mật khẩu hiện tại hoặc xác nhận mật khẩu không hợp lệ." }, 400);
  const policyError = getPasswordPolicyError(newPassword); if (policyError) return json({ error: "Mật khẩu mới không đáp ứng chính sách bảo mật." }, 400);
  const { data, error } = await serverSupabase.from("staff_users").select("id,password_hash,password,session_version").eq("id", actor.id).eq("active", true).single();
  if (error || !data) return json({ error: "Không thể kiểm tra tài khoản." }, 500);
  const valid = data.password_hash ? await verifyPassword(currentPassword, data.password_hash) : (data.password ?? DEFAULT_FIRST_LOGIN_PASSWORD) === currentPassword;
  if (!valid) return json({ error: "Mật khẩu hiện tại không đúng." }, 401);
  const passwordHash = await hashPassword(newPassword);
  const updated = await serverSupabase.from("staff_users").update({ password_hash: passwordHash, password: null, must_change_password: false, session_version: data.session_version + 1 }).eq("id", actor.id).eq("session_version", data.session_version).select("id").maybeSingle();
  if (updated.error || !updated.data) return json({ error: "Mật khẩu đã được thay đổi ở nơi khác. Vui lòng thử lại." }, 409);
  return json({ ok: true, message: "Đã đổi mật khẩu và thu hồi các phiên đăng nhập cũ." });
}
