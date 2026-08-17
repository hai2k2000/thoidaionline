type TaskAssignmentPermission = {
  can_assign_task?: boolean;
};

export function canAccessTaskAssignment(
  permissions: TaskAssignmentPermission,
): boolean {
  return permissions.can_assign_task === true;
}
