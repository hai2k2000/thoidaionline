import { NextResponse } from "next/server";
import { isSameOriginRequest, SESSION_COOKIE, sessionCookieOptions } from "@/lib/serverSession";

export async function POST() {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
