import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export type SessionPayload = {
  userId: string;
  expiresAt: number;
  sessionVersion?: number;
};

export type VerifiedSessionPayload = {
  userId: string;
  expiresAt: number;
  sessionVersion: number;
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
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  userId: string;
  sessionVersion: number;
  secret: string;
  nowSeconds?: number;
}) {
  return signSessionPayload({
    userId,
    expiresAt: nowSeconds + SESSION_TTL_SECONDS,
    sessionVersion,
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
    return { userId: parsed.userId, expiresAt: parsed.expiresAt, sessionVersion };
  } catch {
    return null;
  }
}
