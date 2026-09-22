import { canAccessJournalismScope } from "./journalismScope.mjs";

export function canUseReportingDepartment(actor, departmentId) {
  if (!canAccessJournalismScope(actor)) return false;
  if (["admin", "tong_bien_tap", "pho_tong_bien_tap"].includes(actor.roleCode)) return true;
  if (actor.permissions?.can_view_department_tasks !== true) return false;
  if (!actor.departmentId) return false;
  return !departmentId || actor.departmentId === departmentId;
}
