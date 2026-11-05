import { isCollaboratorRole, isCollaboratorAllowedPath } from "@/lib/collaboratorRole.mjs";
import { serverSupabase } from "@/lib/serverSupabase";
import { NextRequest, NextResponse } from "next/server";
import { getFirstLoginGateDecision } from "@/lib/firstLoginPassword";
import { verifySignedSessionToken } from "@/lib/sessionToken";
const SESSION_COOKIE = "thoidai_work_session";

function nextWithNonce(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDevelopment = process.env.NODE_ENV === "development";
  const contentSecurityPolicy = `
    default-src 'self';
    base-uri 'self';
    frame-ancestors 'none';
    form-action 'self';
    img-src 'self' data: blob: https:;
    font-src 'self' data:;
    style-src 'self' 'unsafe-inline';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""};
    connect-src 'self' https: blob:;
    worker-src 'self';
    manifest-src 'self';
    object-src 'none';
  `.replace(/\s{2,}/g, " ").trim();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/manifest.webmanifest" || pathname === "/sw.js" || pathname === "/offline.html" || pathname.startsWith("/icons/")) return nextWithNonce(request);
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return nextWithNonce(request);

  const authorization = request.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  const token = request.cookies.get(SESSION_COOKIE)?.value ?? bearer;
  const session = verifySignedSessionToken({ token, secret });
  if (session) {
    // Resolve the live role so existing sessions respect a role reassignment.
    const { data, error } = await serverSupabase.from("staff_users")
      .select("roles(code)").eq("id", session.userId).maybeSingle();
    if (error) return NextResponse.json({ error: "Authorization unavailable" }, { status: 503 });
    const roles = data?.roles as unknown as { code: string } | { code: string }[] | null;
    const roleCode = Array.isArray(roles) ? roles[0]?.code : roles?.code;
    if (isCollaboratorRole(roleCode) && !isCollaboratorAllowedPath(pathname, request.method)) {
      return pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Forbidden", code: "forbidden" }, { status: 403, headers: { "Cache-Control": "private, no-store" } })
        : NextResponse.redirect(new URL("/my-tasks", request.url));
    }
  }
  if (pathname === "/profile") return NextResponse.redirect(new URL("/account", request.url));
  if (/^\/users\/[^/]+\/?$/.test(pathname)) return NextResponse.redirect(new URL("/users", request.url));
  if (pathname.startsWith("/uploads/")) {
    let decodedPathname = pathname;
    try {
      decodedPathname = decodeURIComponent(pathname);
    } catch {
      return nextWithNonce(request);
    }
    if (decodedPathname === "/uploads/so_do_luong_cong_viec.docx") {
      return NextResponse.redirect(new URL("/api/download/workflow", request.url));
    }
  }

  const decision = getFirstLoginGateDecision(
    request.nextUrl.pathname,
    session?.mustChangePassword === true,
  );

  if (decision.type === "allow") return nextWithNonce(request);
  if (decision.type === "reject-api") {
    return NextResponse.json(
      { error: "Bạn phải đổi mật khẩu trước khi sử dụng chức năng này.", code: "password_change_required" },
      { status: 428, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return NextResponse.redirect(new URL(decision.location, request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|fonts/|favicon\\.ico$|favicon-td\\.png$|thoidai-logo\\.png$|diditravel-logo\\.png$|(?:file|globe|next|vercel|window)\\.svg$).*)", "/uploads/:path*", "/api/:path*"],
};
