import { NextResponse } from "next/server";
import { createSessionToken, isSameOriginRequest, SESSION_COOKIE, sessionCookieOptions } from "@/lib/serverSession";
import { authenticateCredentials } from "@/lib/authenticateCredentials";

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const body = await request.json().catch(() => null) as { identifier?: string; password?: string } | null;
  const identifier = body?.identifier?.trim().toLowerCase();
  const password = body?.password?.trim();
  if (!identifier || !password) return NextResponse.json({ error: "Sai tài khoản hoặc mật khẩu." }, { status: 401 });

  const authenticated = await authenticateCredentials(identifier, password);
  if (!authenticated) {
    return NextResponse.json({ error: "Sai tài khoản hoặc mật khẩu." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(authenticated.userId, authenticated.sessionVersion), sessionCookieOptions);
  return response;
}
