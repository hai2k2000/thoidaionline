export const REQUIRED_PASSWORD_CHANGE_PATH = "/account?changePassword=required";

const ALLOWED_PATHS = new Set([
  "/account",
  "/api/account/password",
  "/api/account/profile",
  "/api/account/avatar",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/auth/login",
  "/api/auth/mobile-login",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
]);

export type FirstLoginGateDecision =
  | { type: "allow" }
  | { type: "redirect"; location: string }
  | { type: "reject-api" };

export function resolvePostLoginPath(mustChangePassword: boolean) {
  return mustChangePassword ? REQUIRED_PASSWORD_CHANGE_PATH : "/tasks";
}

export function getFirstLoginGateDecision(
  pathname: string,
  mustChangePassword: boolean,
): FirstLoginGateDecision {
  if (!mustChangePassword || ALLOWED_PATHS.has(pathname)) return { type: "allow" };
  if (pathname.startsWith("/api/")) return { type: "reject-api" };
  return { type: "redirect", location: REQUIRED_PASSWORD_CHANGE_PATH };
}
