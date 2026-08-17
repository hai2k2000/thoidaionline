import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { hashPassword } from "@/lib/password";
import { hashResetToken } from "@/lib/passwordReset";
import { getPasswordPolicyError } from "@/lib/passwordPolicy";

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const body = await request.json().catch(() => null) as { token?: string; password?: string } | null;
  const token = body?.token?.trim();
  const password = body?.password ?? "";
  if (!token || token.length < 32 || getPasswordPolicyError(password)) return NextResponse.json({ error: "Liên kết hoặc mật khẩu không hợp lệ." }, { status: 400 });
  const passwordHash = await hashPassword(password);
  const { data, error } = await serverSupabase.rpc("consume_password_reset", { p_token_hash: hashResetToken(token), p_password_hash: passwordHash });
  if (error || data !== true) return NextResponse.json({ error: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
