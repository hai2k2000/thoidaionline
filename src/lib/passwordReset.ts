import "server-only";

import { createHash, createHmac, randomBytes } from "node:crypto";
import { serverSupabase } from "@/lib/serverSupabase";

export const GENERIC_RESET_MESSAGE = "Nếu thông tin phù hợp, hướng dẫn đặt lại mật khẩu sẽ được gửi tới email đã đăng ký.";

export function createResetToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashResetFingerprint(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required.");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function sendResetEmail(to: string, token: string, request: Request) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_EMAIL_FROM;
  if (!key || !from) return false;
  const configuredBase = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!configuredBase) return false;
  const base = configuredBase;
  const link = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Đặt lại mật khẩu Thời Đại Work",
      text: `Bạn vừa yêu cầu đặt lại mật khẩu cho Thời Đại Work. Liên kết có hiệu lực trong 60 phút và chỉ dùng một lần.\n\n${link}\n\nNếu không phải bạn, hãy bỏ qua email này.`,
      html: `<p>Bạn vừa yêu cầu đặt lại mật khẩu cho Thời Đại Work.</p><p>Liên kết có hiệu lực trong 60 phút và chỉ dùng một lần.</p><p><a href="${link}">Đặt lại mật khẩu</a></p><p>Nếu không phải bạn, hãy bỏ qua email này.</p>`,
    }),
  });
  return response.ok;
}

export async function createResetRecord(userId: string, hash: string) {
  const { error } = await serverSupabase.from("password_reset_tokens").insert({
    user_id: userId,
    token_hash: hash,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  return !error;
}
