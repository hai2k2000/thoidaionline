export const PERMISSION_KEYS = [
  "can_manage_users",
  "can_manage_permissions",
  "can_create_task",
  "can_edit_all_tasks",
  "can_comment",
  "can_assign_task",
  "can_view_department_tasks",
  "can_evaluate_step1",
  "can_evaluate_step2",
  "can_manage_rubrics",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type PermissionSet = Record<PermissionKey, boolean>;

export function normalizePermissions(
  value: Partial<Record<PermissionKey, unknown>> | null | undefined,
): PermissionSet {
  return Object.fromEntries(
    PERMISSION_KEYS.map((key) => [key, value?.[key] === true]),
  ) as PermissionSet;
}
