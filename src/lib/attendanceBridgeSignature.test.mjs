import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAttendanceBridgeSignature,
  verifyAttendanceBridgeSignature,
} from "./attendanceBridgeSignature.ts";

test("bridge signature verifies the exact canonical request", () => {
  const secret = "a".repeat(32);
  const request = {
    method: "POST",
    path: "/api/attendance/sync/realtime",
    timestamp: "1789470000",
    nonce: "0123456789abcdef",
    body: '{"enroll_number":"12"}',
  };
  const signature = buildAttendanceBridgeSignature(secret, request);

  assert.equal(verifyAttendanceBridgeSignature(secret, request, signature), true);
});

test("bridge signature rejects a modified body", () => {
  const secret = "b".repeat(32);
  const request = {
    method: "POST",
    path: "/api/attendance/sync/complete",
    timestamp: "1789470000",
    nonce: "fedcba9876543210",
    body: '{"punches":[]}',
  };
  const signature = buildAttendanceBridgeSignature(secret, request);

  assert.equal(verifyAttendanceBridgeSignature(secret, { ...request, body: '{"punches":[1]}' }, signature), false);
});
