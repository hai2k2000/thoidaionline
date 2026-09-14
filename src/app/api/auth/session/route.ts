import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/serverSession";
import { getSessionUser } from "@/lib/serverSession";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const response = NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(SESSION_COOKIE, createSessionToken(user.id, user.session_version, false), sessionCookieOptions);
  return response;
}
