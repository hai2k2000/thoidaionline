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
