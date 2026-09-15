import "server-only";

import { verifyAttendanceBridgeSignature } from "@/lib/attendanceBridgeSignature";

const seenNonces = new Map<string, number>();
const requestCounts = new Map<string, { startedAt: number; count: number }>();
const MAX_CLOCK_SKEW_SECONDS = 300;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 120;

export async function bridgeAuthorized(request: Request): Promise<boolean> {
  const secret = process.env.ATTENDANCE_BRIDGE_TOKEN;
  const timestamp = request.headers.get("x-attendance-bridge-timestamp") ?? "";
  const nonce = request.headers.get("x-attendance-bridge-nonce") ?? "";
  const signature = request.headers.get("x-attendance-bridge-signature") ?? "";
  if (!secret || secret.length < 32 || !/^\d{10}$/.test(timestamp) || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) return false;

  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const rate = requestCounts.get(clientKey);
  if (!rate || now - rate.startedAt >= RATE_WINDOW_MS) requestCounts.set(clientKey, { startedAt: now, count: 1 });
  else if (rate.count >= RATE_LIMIT) return false;
  else rate.count += 1;

  for (const [key, expiresAt] of seenNonces) if (expiresAt <= now) seenNonces.delete(key);
  const nonceKey = `${timestamp}:${nonce}`;
  if (seenNonces.has(nonceKey)) return false;

  const body = await request.clone().text();
  const path = new URL(request.url).pathname;
  if (!verifyAttendanceBridgeSignature(secret, { method: request.method, path, timestamp, nonce, body }, signature)) return false;
  seenNonces.set(nonceKey, now + MAX_CLOCK_SKEW_SECONDS * 1000);
  return true;
}

export function configuredAttendanceDeviceId() {
  return process.env.ATTENDANCE_DEVICE_ID?.trim() || "wise-eye-on-39-machine-1";
}

export function vietnamDate(value: Date = new Date()) {
  return value.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

export function validateAttendanceRange(period: string, start: string, end: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return false;
  const startDate = new Date(`${start}T12:00:00Z`);
  const endDate = new Date(`${end}T12:00:00Z`);
  if (!Number.isFinite(startDate.valueOf()) || !Number.isFinite(endDate.valueOf())) return false;
  if (startDate.toISOString().slice(0, 10) !== start || endDate.toISOString().slice(0, 10) !== end) return false;
  const days = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  if (period === "day") return days === 1;
  if (period === "week") return days === 7;
  if (period !== "month" || !start.endsWith("-01") || start.slice(0, 7) !== end.slice(0, 7)) return false;
  const lastDay = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0, 12));
  return endDate.getUTCDate() === lastDay.getUTCDate();
}
