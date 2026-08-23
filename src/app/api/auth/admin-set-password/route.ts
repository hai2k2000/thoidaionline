import { NextResponse } from "next/server";
import {
  executeAdminSetPassword,
  getAdminSetPasswordTargetError,
  type AdminSetPasswordTarget,
} from "@/lib/adminSetPassword";
import { hashPassword } from "@/lib/password";
import { getPasswordPolicyError } from "@/lib/passwordPolicy";
import { hashResetFingerprint } from "@/lib/passwordReset";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 5;

const messages = {
  invalid_origin: "Nguồn yêu cầu không hợp lệ.",
  unauthenticated: "Phiên đăng nhập không hợp lệ.",
  forbidden: "Chỉ quản trị viên được đặt mật khẩu nhân viên.",
  invalid_request: "Yêu cầu không hợp lệ.",
  password_mismatch: "Mật khẩu xác nhận không khớp.",
  weak_password: "Mật khẩu không đáp ứng chính sách bảo mật.",
  self_reset_forbidden: "Quản trị viên phải dùng luồng quên mật khẩu cho chính mình.",
  user_not_found: "Không tìm thấy nhân viên.",
  user_inactive: "Không thể đặt mật khẩu cho tài khoản đã khóa.",
  rate_limited: "Thao tác quá nhiều lần. Vui lòng thử lại sau.",
  update_failed: "Không thể cập nhật mật khẩu.",
  password_updated: "Đã cập nhật mật khẩu và đăng xuất các phiên cũ của nhân viên.",
} as const;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE_HEADERS });

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return json({ ok: false, code: "invalid_origin", error: messages.invalid_origin }, 403);
  const actor = await getSessionUser();
  if (!actor) return json({ ok: false, code: "unauthenticated", error: messages.unauthenticated }, 401);
  if (actor.role_code !== "admin") return json({ ok: false, code: "forbidden", error: messages.forbidden }, 403);

  const body = await request.json().catch(() => null) as {
    userId?: unknown;
    newPassword?: unknown;
    confirmPassword?: unknown;
  } | null;
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  const confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : "";
  if (!UUID_PATTERN.test(userId)) return json({ ok: false, code: "invalid_request", error: messages.invalid_request }, 400);
  if (actor.id === userId) return json({ ok: false, code: "self_reset_forbidden", error: messages.self_reset_forbidden }, 409);
  if (newPassword !== confirmPassword) return json({ ok: false, code: "password_mismatch", error: messages.password_mismatch }, 400);
  if (getPasswordPolicyError(newPassword)) return json({ ok: false, code: "weak_password", error: messages.weak_password }, 400);

  const fingerprint = hashResetFingerprint(`admin-set-password:${actor.id}:${userId}`);
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const attempts = await serverSupabase
    .from("password_reset_attempts")
    .select("id", { count: "exact", head: true })
    .eq("fingerprint_hash", fingerprint)
    .gte("created_at", since);
  if (attempts.error) return json({ ok: false, code: "update_failed", error: messages.update_failed }, 500);
  const recorded = await serverSupabase.from("password_reset_attempts").insert({ fingerprint_hash: fingerprint });
  if (recorded.error) return json({ ok: false, code: "update_failed", error: messages.update_failed }, 500);
  if ((attempts.count ?? 0) >= RATE_LIMIT) return json({ ok: false, code: "rate_limited", error: messages.rate_limited }, 429);

  const targetResult = await serverSupabase
    .from("staff_users")
    .select("id,active")
    .eq("id", userId)
    .maybeSingle();
  if (targetResult.error) return json({ ok: false, code: "update_failed", error: messages.update_failed }, 500);
  const target = targetResult.data as AdminSetPasswordTarget | null;
  const targetError = getAdminSetPasswordTargetError(target);
  if (targetError) {
    return json({ ok: false, code: targetError, error: messages[targetError] }, targetError === "user_not_found" ? 404 : 409);
  }

  try {
    const updated = await executeAdminSetPassword({
      actorId: actor.id,
      target: target as AdminSetPasswordTarget,
      newPassword,
      hashPassword,
      setPassword: async ({ actorId, userId: targetId, passwordHash }) => {
        const result = await serverSupabase.rpc("admin_set_staff_password", {
          p_actor_id: actorId,
          p_user_id: targetId,
          p_password_hash: passwordHash,
        });
        return !result.error && result.data === true;
      },
    });
    if (!updated) return json({ ok: false, code: "update_failed", error: messages.update_failed }, 409);
  } catch {
    return json({ ok: false, code: "update_failed", error: messages.update_failed }, 500);
  }
  return json({ ok: true, code: "password_updated", message: messages.password_updated });
}
