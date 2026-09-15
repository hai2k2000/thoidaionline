import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type AttendanceBridgeSignedRequest = {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  body: string;
};

export function buildAttendanceBridgeSignature(secret: string, request: AttendanceBridgeSignedRequest) {
  const bodyHash = createHash("sha256").update(request.body, "utf8").digest("hex");
  const canonical = `${request.method}\n${request.path}\n${request.timestamp}\n${request.nonce}\n${bodyHash}`;
  return createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
}

export function verifyAttendanceBridgeSignature(secret: string, request: AttendanceBridgeSignedRequest, signature: string) {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  const actual = Buffer.from(signature, "hex");
  const expected = Buffer.from(buildAttendanceBridgeSignature(secret, request), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
