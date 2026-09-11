import { NextRequest, NextResponse } from "next/server";
import { getFirstLoginGateDecision } from "@/lib/firstLoginPassword";
import { verifySignedSessionToken } from "@/lib/sessionToken";
const SESSION_COOKIE = "thoidai_work_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/profile") return NextResponse.redirect(new URL("/account", request.url));
  if (/^\/users\/[^/]+\/?$/.test(pathname)) return NextResponse.redirect(new URL("/users", request.url));
  if (pathname.startsWith("/uploads/")) {
    let decodedPathname = pathname;
    try {
      decodedPathname = decodeURIComponent(pathname);
    } catch {
      return NextResponse.next();
    }
    if (decodedPathname === "/uploads/so_do_luong_cong_viec.docx") {
      return NextResponse.redirect(new URL("/api/download/workflow", request.url));
    }
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return NextResponse.next();

  const authorization = request.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  const token = request.cookies.get(SESSION_COOKIE)?.value ?? bearer;
  const session = verifySignedSessionToken({ token, secret });
  const decision = getFirstLoginGateDecision(
    request.nextUrl.pathname,
    session?.mustChangePassword === true,
  );

  if (decision.type === "allow") return NextResponse.next();
  if (decision.type === "reject-api") {
    return NextResponse.json(
      { error: "Bạn phải đổi mật khẩu trước khi sử dụng chức năng này.", code: "password_change_required" },
      { status: 428, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return NextResponse.redirect(new URL(decision.location, request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
