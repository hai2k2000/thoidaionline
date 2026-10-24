import { NextResponse } from "next/server";
import { createSessionToken, isSameOriginRequest, SESSION_COOKIE, sessionCookieOptions } from "@/lib/serverSession";
import { authenticateCredentials, AuthenticationUnavailableError } from "@/lib/authenticateCredentials";
import { clearLoginAttempts, consumeLoginAttempt } from "@/lib/loginRateLimit";

export async function POST(request: Request) {
  if (!(await isSameOriginRequest())) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4096) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  const body = await request.json().catch(() => null) as { identifier?: string; password?: string } | null;
  if (typeof body?.identifier !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Sai tài khoản hoặc mật khẩu." }, { status: 401 });
  }
  const identifier = body.identifier.trim().toLowerCase();
  // Passwords are opaque secrets; preserve the exact user input for verification.
  const password = body.password;
  if (identifier.length < 1 || identifier.length > 200 || password.length < 1 || password.length > 200) {
    return NextResponse.json({ error: "Sai tài khoản hoặc mật khẩu." }, { status: 401 });
  }

  const source = request.headers.get("x-real-ip")?.trim() || "unknown";
  const throttleKey = `${source}:${identifier}`;
  const throttle = consumeLoginAttempt(throttleKey);
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: "Thử đăng nhập quá nhiều lần. Vui lòng thử lại sau." },
      { status: 429, headers: { "Retry-After": String(throttle.retryAfter) } },
    );
  }

  let authenticated;
  try {
    authenticated = await authenticateCredentials(identifier, password);
  } catch (error) {
    if (error instanceof AuthenticationUnavailableError) {
      return NextResponse.json({ error: "Hệ thống đăng nhập tạm thời chưa sẵn sàng. Vui lòng thử lại." }, { status: 503, headers: { "Retry-After": "5" } });
    }
    throw error;
  }
  if (!authenticated) {
    return NextResponse.json({ error: "Sai tài khoản hoặc mật khẩu." }, { status: 401 });
  }
  clearLoginAttempts(throttleKey);

  const response = NextResponse.json({ ok: true, mustChangePassword: false });
  response.cookies.set(
    SESSION_COOKIE,
    createSessionToken(authenticated.userId, authenticated.sessionVersion, false),
    sessionCookieOptions,
  );
  return response;
}
