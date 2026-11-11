import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionToken, getSessionUser, SESSION_COOKIE, sessionCookieOptions, verifySessionToken } from "@/lib/serverSession";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const response = NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
  // Non-remembered sessions keep their existing 8h sliding refresh; remembered ones are renewed in proxy.ts.
  const session = verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (session && !session.remember) response.cookies.set(SESSION_COOKIE, createSessionToken(user.id, user.session_version, false), sessionCookieOptions);
  return response;
}
