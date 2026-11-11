import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUser, verifySessionToken, isSameOriginRequest, SESSION_COOKIE, sessionCookieOptions } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";

export async function POST() {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  // A remembered session may have a 30-day renewal in flight; bumping session_version revokes it.
  const session = verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  const user = session?.remember ? await getSessionUser() : null;
  if (user) {
    const { error } = await serverSupabase.from("staff_users")
      .update({ session_version: user.session_version + 1 })
      .eq("id", user.id).eq("session_version", user.session_version);
    if (error) return NextResponse.json({ error: "Không thể đăng xuất phiên." }, { status: 500 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
