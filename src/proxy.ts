import { NextResponse, type NextRequest } from "next/server";

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
  return NextResponse.next();
}

export const config = { matcher: ["/profile", "/users/:path*", "/uploads/:path*"] };
