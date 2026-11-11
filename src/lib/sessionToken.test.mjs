import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import {
  createSignedSessionToken,
  REMEMBERED_SESSION_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  signSessionPayload,
  shouldRenewRememberedSession,
  verifySignedSessionToken,
} from "./sessionToken.ts";

const signingSecret = () => randomBytes(32).toString("base64url");

test("new sessions preserve the database session version", () => {
  const secret = signingSecret();
  const token = createSignedSessionToken({
    userId: "00000000-0000-4000-8000-000000000001",
    sessionVersion: 4,
    secret,
    nowSeconds: 100,
  });
  assert.deepEqual(verifySignedSessionToken({ token, secret, nowSeconds: 101 }), {
    userId: "00000000-0000-4000-8000-000000000001",
    expiresAt: 28900,
    sessionVersion: 4,
    mustChangePassword: false,
    remember: false,
    issuedAt: 100,
  });
});

test("remembered and ordinary sessions use their respective TTLs", () => {
  const secret = signingSecret();
  const remembered = createSignedSessionToken({ userId: "u", sessionVersion: 1, remember: true, secret, nowSeconds: 100 });
  const ordinary = createSignedSessionToken({ userId: "u", sessionVersion: 1, remember: false, secret, nowSeconds: 100 });
  const payload = verifySignedSessionToken({ token: remembered, secret, nowSeconds: 101 });
  assert.equal(payload.expiresAt, 100 + 30 * 24 * 60 * 60);
  assert.equal(payload.issuedAt, 100);
  assert.equal(payload.remember, true);
  assert.equal(verifySignedSessionToken({ token: remembered, secret, nowSeconds: payload.expiresAt - 1 })?.userId, "u");
  assert.equal(verifySignedSessionToken({ token: ordinary, secret, nowSeconds: 101 })?.expiresAt, 100 + 8 * 60 * 60);
  assert.equal(verifySignedSessionToken({ token: remembered, secret, nowSeconds: 100 + REMEMBERED_SESSION_TTL_SECONDS }), null);
  assert.equal(verifySignedSessionToken({ token: ordinary, secret, nowSeconds: 100 + SESSION_TTL_SECONDS }) , null);
});

test("legacy tokens without remember fields still verify as ordinary sessions", () => {
  const secret = signingSecret();
  const token = signSessionPayload({ userId: "u", expiresAt: 200 }, secret);
  const verified = verifySignedSessionToken({ token, secret, nowSeconds: 100 });
  assert.equal(verified?.userId, "u");
  assert.equal(verified?.remember, false);
});

test("must-change-password sessions cannot be remembered", () => {
  const secret = signingSecret();
  const token = createSignedSessionToken({ userId: "u", sessionVersion: 1, remember: true, mustChangePassword: true, secret, nowSeconds: 100 });
  assert.equal(verifySignedSessionToken({ token, secret, nowSeconds: 100 + SESSION_TTL_SECONDS - 1 })?.remember, false);
  assert.equal(verifySignedSessionToken({ token, secret, nowSeconds: 100 + SESSION_TTL_SECONDS }), null);
});

test("renewal starts only after one day for remembered sessions", () => {
  assert.equal(shouldRenewRememberedSession({ remember: true, issuedAt: 100 }, 100 + 86400 - 1), false);
  assert.equal(shouldRenewRememberedSession({ remember: true, issuedAt: 100 }, 100 + 86400), true);
  assert.equal(shouldRenewRememberedSession({ remember: false, issuedAt: 100 }, 100 + 86400), false);
});

test("new sessions preserve the first-login password requirement", () => {
  const secret = signingSecret();
  const token = createSignedSessionToken({
    userId: "00000000-0000-4000-8000-000000000001",
    sessionVersion: 4,
    mustChangePassword: true,
    secret,
    nowSeconds: 100,
  });
  assert.equal(
    verifySignedSessionToken({ token, secret, nowSeconds: 101 })?.mustChangePassword,
    true,
  );
});

test("legacy sessions without a version normalize to zero", () => {
  const secret = signingSecret();
  const token = signSessionPayload({
    userId: "00000000-0000-4000-8000-000000000001",
    expiresAt: 200,
  }, secret);
  assert.equal(
    verifySignedSessionToken({ token, secret, nowSeconds: 100 })?.sessionVersion,
    0,
  );
});

test("expired, negative-version and fractional-version sessions are rejected", () => {
  const secret = signingSecret();
  const expired = signSessionPayload({ userId: "u", expiresAt: 99 }, secret);
  const negative = signSessionPayload({ userId: "u", expiresAt: 200, sessionVersion: -1 }, secret);
  const fractional = signSessionPayload({ userId: "u", expiresAt: 200, sessionVersion: 1.5 }, secret);
  assert.equal(verifySignedSessionToken({ token: expired, secret, nowSeconds: 100 }), null);
  assert.equal(verifySignedSessionToken({ token: negative, secret, nowSeconds: 100 }), null);
  assert.equal(verifySignedSessionToken({ token: fractional, secret, nowSeconds: 100 }), null);
});

test("tampered signatures are rejected", () => {
  const secret = signingSecret();
  const token = createSignedSessionToken({ userId: "u", sessionVersion: 0, secret, nowSeconds: 100 });
  const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
  assert.equal(verifySignedSessionToken({ token: tampered, secret, nowSeconds: 101 }), null);
});
