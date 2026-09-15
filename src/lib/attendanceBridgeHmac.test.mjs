import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const auth = readFileSync("src/lib/attendanceBridgeAuth.ts", "utf8");
const signature = readFileSync("src/lib/attendanceBridgeSignature.ts", "utf8");
const realtime = readFileSync("bridge/windows/attendance-realtime.ps1", "utf8");
const batch = readFileSync("bridge/windows/attendance-bridge.ps1", "utf8");

test("bridge authentication signs method, path, timestamp, nonce, and body hash", () => {
  assert.match(signature, /createHmac/);
  assert.match(auth, /x-attendance-bridge-timestamp/);
  assert.match(auth, /x-attendance-bridge-nonce/);
  assert.match(auth, /x-attendance-bridge-signature/);
  assert.match(signature, /createHash\("sha256"\)/);
  assert.match(signature, /timingSafeEqual/);
  assert.match(auth, /async function bridgeAuthorized/);
});

test("bridge rejects stale or replayed signed requests", () => {
  assert.match(auth, /300/);
  assert.match(auth, /nonce/i);
  assert.match(auth, /Map/);
  assert.match(auth, /rate/i);
});

test("Windows bridge emits signed requests", () => {
  assert.match(realtime, /HMACSHA256/);
  assert.match(realtime, /x-attendance-bridge-signature/);
  assert.match(batch, /HMACSHA256/);
  assert.match(batch, /x-attendance-bridge-signature/);
});
