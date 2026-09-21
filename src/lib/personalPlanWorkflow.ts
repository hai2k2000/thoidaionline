export type PersonalPlanRow = {
  schedule_scope: string | null;
  approval_status: string;
  created_by: string;
  department_id?: string | null;
  approver_id: string | null;
};

export type ReviewActor = {
  id: string;
  role_code: string;
  department_id: string | null;
};

const GLOBAL_APPROVER_ROLES = new Set(["admin", "tong_bien_tap", "pho_tong_bien_tap"]);

export function isPersonalScope(value: unknown): value is "personal" {
  return value === "personal";
}

export function canReviewPersonalPlan(actor: ReviewActor, row: PersonalPlanRow) {
  if (!isPersonalScope(row.schedule_scope)) return { ok: false as const, reason: "not_personal" };
  if (row.approval_status !== "PENDING_APPROVAL") return { ok: false as const, reason: "not_pending" };
  if (actor.id === row.created_by) return { ok: false as const, reason: "self_review" };
  if (GLOBAL_APPROVER_ROLES.has(actor.role_code)) return { ok: true as const };
  if (!row.approver_id || row.approver_id !== actor.id) return { ok: false as const, reason: "out_of_scope" };
  if (!row.department_id || actor.department_id !== row.department_id) return { ok: false as const, reason: "out_of_scope" };
  return { ok: true as const };
}
