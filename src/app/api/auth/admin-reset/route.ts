import { NextResponse } from "next/server";
import { type AdminResetTarget, executeAdminPasswordReset, getAdminResetTargetError } from "@/lib/adminPasswordReset";
import { getSessionUser, isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { createResetToken, sendResetEmail } from "@/lib/passwordReset";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const messages = {
  invalid_request: "Yêu cầu không hợp lệ.",
  unauthenticated: "Phiên đăng nhập không hợp lệ.",
  invalid_origin: "Nguồn yêu cầu không hợp lệ.",
  forbidden: "Chỉ Admin được đặt lại mật khẩu nhân viên.",
  user_not_found: "Không tìm thấy nhân viên.",
  user_inactive: "Không thể đặt lại mật khẩu cho tài khoản đã khóa.",
  email_missing: "Nhân viên chưa có email đăng ký.",
  reset_prepare_failed: "Không thể chuẩn bị yêu cầu đặt lại mật khẩu.",
  audit_finalize_failed: "Không thể hoàn tất nhật ký gửi email.",
  email_delivery_failed: "Không thể gửi email đặt lại mật khẩu.",
  reset_email_sent: "Đã gửi liên kết đặt lại mật khẩu.",
} as const;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE_HEADERS });

const errorStatus = {
  reset_prepare_failed: 500,
  audit_finalize_failed: 500,
  email_delivery_failed: 502,
} as const;

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) {
    return json({ ok: false, code: "invalid_origin", error: messages.invalid_origin }, 403);
  }
  const actor = await getSessionUser();
  if (!actor) return json({ ok: false, code: "unauthenticated", error: messages.unauthenticated }, 401);
  if (actor.role_code !== "admin") return json({ ok: false, code: "forbidden", error: messages.forbidden }, 403);

  const body = await request.json().catch(() => null) as { userId?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  if (!UUID_PATTERN.test(userId)) {
    return json({ ok: false, code: "invalid_request", error: messages.invalid_request }, 400);
  }

  const { data: rawTarget, error } = await serverSupabase
    .from("staff_users")
    .select("id,email,active")
    .eq("id", userId)
    .maybeSingle();
  if (error) return json({ ok: false, code: "reset_prepare_failed", error: messages.reset_prepare_failed }, 500);

  const data = rawTarget as unknown as AdminResetTarget | null;
  const targetError = getAdminResetTargetError(data);
  if (targetError) {
    const status = targetError === "user_not_found" ? 404 : targetError === "user_inactive" ? 409 : 422;
    return json({ ok: false, code: targetError, error: messages[targetError] }, status);
  }

  const eligibleTarget = data as AdminResetTarget & { email: string };

  let result: Awaited<ReturnType<typeof executeAdminPasswordReset>>;
  try {
    result = await executeAdminPasswordReset({
      actorId: actor.id,
      target: eligibleTarget,
      request,
      createToken: createResetToken,
      prepare: async ({ actorId, userId: targetId, tokenHash, expiresAt }) => {
        const { data: prepared, error: prepareError } = await serverSupabase.rpc(
          "prepare_admin_password_reset",
          { p_actor_id: actorId, p_user_id: targetId, p_token_hash: tokenHash, p_expires_at: expiresAt },
        );
        const row = Array.isArray(prepared) ? prepared[0] : prepared;
        return prepareError || !row?.token_id || !row?.audit_id
          ? null
          : { tokenId: row.token_id, auditId: row.audit_id };
      },
      sendEmail: sendResetEmail,
      finalize: async ({ tokenId, auditId, status }) => {
        const { data: finalized, error: finalizeError } = await serverSupabase.rpc(
          "finalize_admin_password_reset",
          { p_token_id: tokenId, p_audit_id: auditId, p_status: status },
        );
        return !finalizeError && finalized === true;
      },
    });
  } catch {
    return json(
      { ok: false, code: "reset_prepare_failed", error: messages.reset_prepare_failed },
      500,
    );
  }

  if (!result.ok) {
    return json({ ok: false, code: result.code, error: messages[result.code] }, errorStatus[result.code]);
  }
  return json({ ok: true, code: result.code, message: messages[result.code] });
}
