import "server-only";

export function parseTaskRbacV2Enabled(value: unknown): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

export function isTaskRbacV2Enabled(value = process.env.TASK_RBAC_V2_ENABLED): boolean {
  return parseTaskRbacV2Enabled(value);
}
