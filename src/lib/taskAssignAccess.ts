type TaskAssignmentPermission = {
  role_code?: string;
  can_assign_task?: boolean;
  is_department_manager?: boolean;
};

export function canAccessTaskAssignment(
  permissions: TaskAssignmentPermission,
): boolean {
  return permissions.can_assign_task === true
    || permissions.is_department_manager === true
    || ["tong_bien_tap", "pho_tong_bien_tap"].includes(permissions.role_code ?? "");
}
