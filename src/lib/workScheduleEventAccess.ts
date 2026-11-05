export const EVENT_ASSIGNMENT_ROLES = ["admin", "tong_bien_tap", "pho_tong_bien_tap", "truong_phong"] as const;
export const GLOBAL_EVENT_ASSIGNMENT_ROLES = ["admin", "tong_bien_tap", "pho_tong_bien_tap"] as const;

export function canEditEventAssignment(
  row: { created_by?: string | null; event_status?: string | null },
  actor: { id?: string; role_code?: string; is_department_manager?: boolean },
) {
  if (!actor.id || !["SCHEDULED", "COMPLETED"].includes(row.event_status ?? "")) return false;
  if (GLOBAL_EVENT_ASSIGNMENT_ROLES.some((role) => role === actor.role_code)) return true;
  return actor.role_code !== "pho_truong_phong"
    && (actor.role_code === "truong_phong" || actor.is_department_manager === true)
    && row.created_by === actor.id;
}

export function outOfListEventMembers(selected: string[], people: { id: string }[]) {
  const visibleIds = new Set(people.map((person) => person.id));
  return selected.filter((id) => !visibleIds.has(id));
}

export function canAssignEvents(actor: { role_code: string; is_department_manager: boolean }) {
  return EVENT_ASSIGNMENT_ROLES.includes(actor.role_code as (typeof EVENT_ASSIGNMENT_ROLES)[number]) || actor.is_department_manager;
}

export function eventAssignmentPeople<T extends { active?: boolean; username?: string | null; full_name?: string | null; department_id?: string | null; roles?: { code?: string } | null; job_titles?: { code?: string } | null }>(people: T[], actor: { role_code: string; department_id?: string | null }) {
  const global = GLOBAL_EVENT_ASSIGNMENT_ROLES.includes(actor.role_code as (typeof GLOBAL_EVENT_ASSIGNMENT_ROLES)[number]);
  return people.filter((person) =>
    person.active === true &&
    !["admin", "cong_tac_vien"].includes(person.roles?.code?.trim().toLowerCase() ?? "") &&
    person.username?.trim().toLowerCase() !== "admin" &&
    person.full_name?.trim().toLowerCase() !== "admin" &&
    (global || (Boolean(actor.department_id) && person.department_id === actor.department_id)),
  );
}
