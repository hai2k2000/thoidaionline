import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import {
  createSignedSessionToken,
  signSessionPayload,
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
  });
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
