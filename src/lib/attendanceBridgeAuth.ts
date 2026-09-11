import "server-only";

export function bridgeAuthorized(request: Request): boolean {
  const expected = process.env.ATTENDANCE_BRIDGE_TOKEN;
  const provided = request.headers.get("x-attendance-bridge-token");
  return Boolean(expected && expected.length >= 32 && provided && provided === expected);
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
