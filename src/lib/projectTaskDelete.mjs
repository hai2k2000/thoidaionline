export function canDeleteCancelledProjectTasks({ actorRole, actorId, members, projectStatus, statusFilter }) {
  if (statusFilter !== "cancelled") return false;
  if (actorRole === "admin") return true;
  return projectStatus === "active" && members.some(member => member.user_id === actorId && member.role === "lead" && member.staff_users?.active === true);
}
