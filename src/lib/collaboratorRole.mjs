export const COLLABORATOR_ROLE_CODE = "cong_tac_vien";
const UUID = "[0-9a-f-]{36}";
export function isCollaboratorRole(code) { return String(code ?? "").trim().toLowerCase() === COLLABORATOR_ROLE_CODE; }
export const COLLABORATOR_API_RULES = [
  [`/api/auth/session`, ["GET"]], [`/api/auth/logout`, ["POST"]], [`/api/auth/mobile-logout`, ["POST"]],
  [`/api/account/profile`, ["PATCH"]], [`/api/account/password`, ["PATCH"]], [`/api/account/avatar`, ["POST", "DELETE"]],
  [`/api/tasks`, ["GET"]], [`/api/tasks/${UUID}`, ["GET"]], [`/api/tasks/${UUID}/comments`, ["POST"]],
  [`/api/tasks/${UUID}/attachments`, ["POST"]], [`/api/tasks/${UUID}/attachments/${UUID}`, ["GET"]],
  [`/api/tasks/${UUID}/progress-reports`, ["POST"]], [`/api/tasks/${UUID}/submit-completion`, ["POST"]],
];
export function isCollaboratorAllowedPath(pathname, method = "GET") {
  const path = String(pathname ?? "/").split("?")[0].replace(/\/$/, "") || "/";
  if (path.startsWith("/api/")) return COLLABORATOR_API_RULES.some(([pattern, methods]) => new RegExp(`^${pattern}$`, "i").test(path) && methods.includes(method));
  return path === "/my-tasks" || path === "/account" || new RegExp(`^/tasks/${UUID}$`, "i").test(path);
}
export function isCollaboratorAllowedApiPath(pathname, method = "GET") { return String(pathname ?? "").startsWith("/api/") && isCollaboratorAllowedPath(pathname, method); }
