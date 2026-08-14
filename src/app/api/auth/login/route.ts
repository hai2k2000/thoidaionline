import { NextResponse } from "next/server";
import { createSessionToken, isSameOriginRequest, SESSION_COOKIE, sessionCookieOptions } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { hashPassword, isBcryptHash, verifyPassword } from "@/lib/password";

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const body = await request.json().catch(() => null) as { identifier?: string; password?: string } | null;
  const identifier = body?.identifier?.trim().toLowerCase();
  const password = body?.password?.trim();
  if (!identifier || !password) return NextResponse.json({ error: "Sai tài khoản hoặc mật khẩu." }, { status: 401 });

  const { data, error } = await serverSupabase
    .from("staff_users")
    .select("id,password,password_hash,active")
    .or(`username.eq.${identifier},email.ilike.${identifier},phone.eq.${identifier}`)
    .limit(1)
    .maybeSingle();
  const row = data as { id: string; password: string | null; password_hash: string | null; active: boolean } | null;
  const valid = row && row.active && (isBcryptHash(row.password_hash)
    ? await verifyPassword(password, row.password_hash)
    : (row.password ?? "123456").trim() === password);
  if (error || !row || !valid) {
    return NextResponse.json({ error: "Sai tài khoản hoặc mật khẩu." }, { status: 401 });
  }

  if (!isBcryptHash(row.password_hash)) {
    await serverSupabase.from("staff_users").update({ password_hash: await hashPassword(password), password: null }).eq("id", row.id);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(row.id), sessionCookieOptions);
  return response;
}
