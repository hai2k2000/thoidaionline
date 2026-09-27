import { NextResponse } from "next/server";
import { authenticateCredentials } from "@/lib/authenticateCredentials";
import { createSessionToken } from "@/lib/serverSession";
import { clearLoginAttempts, consumeLoginAttempt } from "@/lib/loginRateLimit";
import { beginAuthDiagnostic, emitAuthDiagnostic, updateAuthDiagnostic } from "@/lib/authDiagnostic";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4096) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const body = await request.json().catch(() => null) as { identifier?: string; password?: string } | null;
  if (typeof body?.identifier !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Sai tài khoản hoặc mật khẩu." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const identifier = body.identifier.trim().toLowerCase();
  const password = body.password.trim();
  if (identifier.length < 1 || identifier.length > 200 || password.length < 1 || password.length > 200) {
    return NextResponse.json({ error: "Sai tài khoản hoặc mật khẩu." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const diagnostic = beginAuthDiagnostic(body.identifier, body.password);

  const source = request.headers.get("x-real-ip")?.trim() || "unknown";
  const throttleKey = `${source}:${identifier}`;
  const throttle = consumeLoginAttempt(throttleKey);
  if (!throttle.allowed) return NextResponse.json({ error: "Thử đăng nhập quá nhiều lần. Vui lòng thử lại sau." }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(throttle.retryAfter) } });
  const authenticated = await authenticateCredentials(identifier, password, diagnostic);
  if (!authenticated) {
    emitAuthDiagnostic(diagnostic);
    return NextResponse.json({ error: "Sai tài khoản hoặc mật khẩu." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  clearLoginAttempts(throttleKey);
  updateAuthDiagnostic(diagnostic, { session_creation_reached: true });
  try {
    const token = createSessionToken(authenticated.userId, authenticated.sessionVersion, false);
    emitAuthDiagnostic(diagnostic, { auth_result: "success" });
    return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    emitAuthDiagnostic(diagnostic, {
      auth_result: "session_failed",
      error_name: error instanceof Error ? error.name : "unknown",
    });
    throw error;
  }
}
