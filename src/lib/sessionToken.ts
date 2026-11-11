import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_TTL_SECONDS = 8 * 60 * 60;
export const REMEMBERED_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export function sessionTtlSeconds(remember = false, mustChangePassword = false) {
  return remember && !mustChangePassword ? REMEMBERED_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS;
}

export function shouldRenewRememberedSession(
  session: { remember?: boolean; issuedAt?: number; mustChangePassword?: boolean },
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  return session.remember === true && session.mustChangePassword !== true
    && Number.isInteger(session.issuedAt) && nowSeconds - session.issuedAt! >= 24 * 60 * 60;
}

export type SessionPayload = {
  userId: string;
  expiresAt: number;
  sessionVersion?: number;
  mustChangePassword?: boolean;
  remember?: boolean;
  issuedAt?: number;
};

export type VerifiedSessionPayload = {
  userId: string;
  expiresAt: number;
  sessionVersion: number;
  mustChangePassword: boolean;
  remember: boolean;
  issuedAt?: number;
};

const signature = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

export function signSessionPayload(payload: SessionPayload, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

export function createSignedSessionToken({
  userId,
  sessionVersion,
  mustChangePassword = false,
  remember = false,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  userId: string;
  sessionVersion: number;
  mustChangePassword?: boolean;
  secret: string;
  remember?: boolean;
  nowSeconds?: number;
}) {
  return signSessionPayload({
    userId,
    expiresAt: nowSeconds + sessionTtlSeconds(remember, mustChangePassword),
    issuedAt: nowSeconds,
    remember: remember === true && !mustChangePassword,
    sessionVersion,
    mustChangePassword,
  }, secret);
}

export function verifySignedSessionToken({
  token,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  token: string | undefined;
  secret: string;
  nowSeconds?: number;
}): VerifiedSessionPayload | null {
  if (!token) return null;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;
  const expectedSignature = signature(payload, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    const sessionVersion = parsed.sessionVersion ?? 0;
    if (!parsed.userId || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= nowSeconds) return null;
    if (!Number.isInteger(sessionVersion) || sessionVersion < 0) return null;
    return {
      userId: parsed.userId,
      expiresAt: parsed.expiresAt,
      sessionVersion,
      mustChangePassword: parsed.mustChangePassword === true,
      remember: parsed.remember === true && parsed.mustChangePassword !== true,
      issuedAt: Number.isInteger(parsed.issuedAt) ? parsed.issuedAt : undefined,
    };
  } catch {
    return null;
  }
}
