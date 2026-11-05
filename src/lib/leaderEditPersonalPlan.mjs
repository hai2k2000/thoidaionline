const GLOBAL_ROLES = new Set(["admin", "tong_bien_tap", "pho_tong_bien_tap"]);

export function canLeaderEditPersonalPlan(row, actor) {
  if (!row?.created_by || !actor?.id || row.schedule_scope !== "personal"
    || !["PENDING_APPROVAL", "APPROVED", "REJECTED"].includes(row.approval_status)) return false;
  if (GLOBAL_ROLES.has(actor.role_code?.toLowerCase())) return true;
  const manager = actor.is_department_manager === true
    || actor.role_code?.toLowerCase() === "truong_phong"
    || String(actor.job_title_code ?? "").toLowerCase().startsWith("truong_phong");
  // The creator relation reflects staff transfers; the event column is a snapshot.
  const department = row.creator ? row.creator.department_id : row.creator_department_id;
  return manager
    && Boolean(actor.department_id)
    && actor.department_id === department;
}
