import { NextResponse } from "next/server";
import { createSessionToken, isSameOriginRequest, SESSION_COOKIE, sessionCookieOptions } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { hashPassword, isBcryptHash, verifyPassword } from "@/lib/password";
import { DEFAULT_FIRST_LOGIN_PASSWORD } from "@/lib/defaultPassword";

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const body = await request.json().catch(() => null) as { identifier?: string; password?: string } | null;
  const identifier = body?.identifier?.trim().toLowerCase();
  const password = body?.password?.trim();
  if (!identifier || !password) return NextResponse.json({ error: "Sai tài khoản hoặc mật khẩu." }, { status: 401 });

  const roleLifecycleEnabled = process.env.ROLE_LIFECYCLE_ENABLED === "true";
  const { data, error } = await serverSupabase
    .from("staff_users")
    .select(`id,password,password_hash,active,session_version${roleLifecycleEnabled ? ",roles!inner(active)" : ""}`)
    .or(`username.eq.${identifier},email.ilike.${identifier},phone.eq.${identifier}`)
    .limit(1)
    .maybeSingle();
  const row = data as { id: string; password: string | null; password_hash: string | null; active: boolean; session_version: number; roles?: { active: boolean } | null } | null;
  const valid = row && row.active && (!roleLifecycleEnabled || row.roles?.active === true) && (isBcryptHash(row.password_hash)
    ? await verifyPassword(password, row.password_hash)
    : (row.password ?? DEFAULT_FIRST_LOGIN_PASSWORD).trim() === password);
  if (error || !row || !valid) {
    return NextResponse.json({ error: "Sai tài khoản hoặc mật khẩu." }, { status: 401 });
  }

  if (!isBcryptHash(row.password_hash)) {
    let upgradeQuery = serverSupabase
      .from("staff_users")
      .update({ password_hash: await hashPassword(password), password: null })
      .eq("id", row.id)
      .eq("session_version", row.session_version);
    upgradeQuery = row.password_hash === null
      ? upgradeQuery.is("password_hash", null)
      : upgradeQuery.eq("password_hash", row.password_hash);
    upgradeQuery = row.password === null
      ? upgradeQuery.is("password", null)
      : upgradeQuery.eq("password", row.password);
    const { data: upgraded, error: upgradeError } = await upgradeQuery
      .select("id")
      .maybeSingle();
    if (upgradeError || !upgraded) {
      return NextResponse.json({ error: "Sai tài khoản hoặc mật khẩu." }, { status: 401 });
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(row.id, row.session_version), sessionCookieOptions);
  return response;
}
