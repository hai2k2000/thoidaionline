import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/profile") return NextResponse.redirect(new URL("/account", request.url));
  if (/^\/users\/[^/]+\/?$/.test(pathname)) return NextResponse.redirect(new URL("/users", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/profile", "/users/:path*"] };
