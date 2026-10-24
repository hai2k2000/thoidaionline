const APPROVER_PERMISSION = "record.approve";
const SELF_APPROVER_PERMISSION = "record.self_approve";

function hasPermission(actor, permission, scopes = null) {
  if (!actor.permissions.includes(permission)) return false;
  if (!scopes) return true;
  const effectiveScopes = actor.permissionScopes?.[permission];
  return Array.isArray(effectiveScopes) && effectiveScopes.some((scope) => scopes.includes(scope));
}

export function canTransitionRecord(actor, record, action, reason = "") {
  if (action === "submit") {
    if (record.status !== "draft") return { ok: false, reason: "invalid_transition" };
    if (!actor.permissions.includes("record.edit")) return { ok: false, reason: "permission_denied" };
    return { ok: true };
  }
  if (action === "approve" || action === "return") {
    if (record.status !== "pending_review") return { ok: false, reason: "invalid_transition" };
    if (!hasPermission(actor, APPROVER_PERMISSION) || record.aclApprove !== true) return { ok: false, reason: "permission_denied" };
    if (actor.id === record.created_by && (action !== "approve" || !hasPermission(actor, SELF_APPROVER_PERMISSION, ["self", "all"]))) return { ok: false, reason: "self_approval_forbidden" };
    if (action === "return" && !String(reason).trim()) return { ok: false, reason: "return_reason_required" };
    return { ok: true };
  }
  return { ok: false, reason: "invalid_action" };
}

export function transitionRecord(record, actor, action, reason = "") {
  if (action === "approve" && record.status === "approved") return { status: "approved", action: "approve", reason: null, replayed: true };
  const decision = canTransitionRecord(actor, record, action, reason);
  if (!decision.ok) throw new Error(decision.reason);
  return action === "submit"
    ? { status: "pending_review", action: "submit_review", reason: null }
    : action === "approve"
      ? { status: "approved", action: "approve", reason: null }
      : { status: "draft", action: "return_for_correction", reason: String(reason).trim() };
}
