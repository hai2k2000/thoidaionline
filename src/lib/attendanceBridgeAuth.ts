import "server-only";

export function bridgeAuthorized(request: Request): boolean {
  const expected = process.env.ATTENDANCE_BRIDGE_TOKEN;
  const provided = request.headers.get("x-attendance-bridge-token");
  return Boolean(expected && expected.length >= 32 && provided && provided === expected);
}
