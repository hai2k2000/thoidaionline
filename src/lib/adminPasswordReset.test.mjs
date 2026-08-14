import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import test from "node:test";

import {
  executeAdminPasswordReset,
  getAdminResetTargetError,
} from "./adminPasswordReset.ts";

const tokenPair = () => {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
};

const target = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "employee@example.invalid",
  active: true,
};

test("target eligibility distinguishes missing, inactive and missing-email users", () => {
  assert.equal(getAdminResetTargetError(null), "user_not_found");
  assert.equal(getAdminResetTargetError({ ...target, active: false }), "user_inactive");
  assert.equal(getAdminResetTargetError({ ...target, email: null }), "email_missing");
  assert.equal(getAdminResetTargetError(target), null);
});

test("successful delivery prepares before send and finalizes sent", async () => {
  const events = [];
  const result = await executeAdminPasswordReset({
    actorId: "00000000-0000-4000-8000-000000000001",
    target,
    request: new Request("https://example.invalid/api/auth/admin-reset"),
    createToken: tokenPair,
    prepare: async () => { events.push("prepare"); return { tokenId: "t", auditId: "a" }; },
    sendEmail: async () => { events.push("send"); return true; },
    finalize: async ({ status }) => { events.push(`finalize:${status}`); return true; },
  });
  assert.deepEqual(events, ["prepare", "send", "finalize:sent"]);
  assert.deepEqual(result, { ok: true, code: "reset_email_sent" });
});

test("prepare failure never calls the email sender", async () => {
  let sent = false;
  const result = await executeAdminPasswordReset({
    actorId: "00000000-0000-4000-8000-000000000001",
    target,
    request: new Request("https://example.invalid/api/auth/admin-reset"),
    createToken: tokenPair,
    prepare: async () => null,
    sendEmail: async () => { sent = true; return true; },
    finalize: async () => true,
  });
  assert.equal(sent, false);
  assert.deepEqual(result, { ok: false, code: "reset_prepare_failed" });
});

test("prepare exceptions map safely and stop before send", async () => {
  const events = [];
  const result = await executeAdminPasswordReset({
    actorId: "00000000-0000-4000-8000-000000000001",
    target,
    request: new Request("https://example.invalid/api/auth/admin-reset"),
    createToken: tokenPair,
    prepare: async () => { events.push("prepare"); throw new Error("prepare exception"); },
    sendEmail: async () => { events.push("send"); return true; },
    finalize: async () => { events.push("finalize"); return true; },
  });
  assert.deepEqual(events, ["prepare"]);
  assert.deepEqual(result, { ok: false, code: "reset_prepare_failed" });
});

test("delivery failure finalizes failed", async () => {
  const statuses = [];
  const result = await executeAdminPasswordReset({
    actorId: "00000000-0000-4000-8000-000000000001",
    target,
    request: new Request("https://example.invalid/api/auth/admin-reset"),
    createToken: tokenPair,
    prepare: async () => ({ tokenId: "t", auditId: "a" }),
    sendEmail: async () => false,
    finalize: async ({ status }) => { statuses.push(status); return true; },
  });
  assert.deepEqual(statuses, ["failed"]);
  assert.deepEqual(result, { ok: false, code: "email_delivery_failed" });
});

test("sendEmail exceptions are treated as failed delivery and still finalize", async () => {
  const events = [];
  const result = await executeAdminPasswordReset({
    actorId: "00000000-0000-4000-8000-000000000001",
    target,
    request: new Request("https://example.invalid/api/auth/admin-reset"),
    createToken: tokenPair,
    prepare: async () => { events.push("prepare"); return { tokenId: "t", auditId: "a" }; },
    sendEmail: async () => { events.push("send"); throw new Error("delivery exception"); },
    finalize: async ({ status }) => { events.push(`finalize:${status}`); return true; },
  });
  assert.deepEqual(events, ["prepare", "send", "finalize:failed"]);
  assert.deepEqual(result, { ok: false, code: "email_delivery_failed" });
});

test("finalize failure returns an audit error without retrying email", async () => {
  let sends = 0;
  const result = await executeAdminPasswordReset({
    actorId: "00000000-0000-4000-8000-000000000001",
    target,
    request: new Request("https://example.invalid/api/auth/admin-reset"),
    createToken: tokenPair,
    prepare: async () => ({ tokenId: "t", auditId: "a" }),
    sendEmail: async () => { sends += 1; return true; },
    finalize: async () => false,
  });
  assert.equal(sends, 1);
  assert.deepEqual(result, { ok: false, code: "audit_finalize_failed" });
});

test("finalize exceptions return an audit error without retrying email", async () => {
  let sends = 0;
  const result = await executeAdminPasswordReset({
    actorId: "00000000-0000-4000-8000-000000000001",
    target,
    request: new Request("https://example.invalid/api/auth/admin-reset"),
    createToken: tokenPair,
    prepare: async () => ({ tokenId: "t", auditId: "a" }),
    sendEmail: async () => { sends += 1; return true; },
    finalize: async () => { throw new Error("finalize exception"); },
  });
  assert.equal(sends, 1);
  assert.deepEqual(result, { ok: false, code: "audit_finalize_failed" });
});
