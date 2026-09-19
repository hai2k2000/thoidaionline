export function canUseReportingDepartment(actor, departmentId) {
  if (!departmentId) return true;
  if (["admin", "tong_bien_tap", "tbt_read_only"].includes(actor.roleCode)) return true;
  return actor.permissions?.can_view_department_tasks === true
    && actor.departmentId !== null
    && actor.departmentId === departmentId;
}
