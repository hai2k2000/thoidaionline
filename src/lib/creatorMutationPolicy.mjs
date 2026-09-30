const VALID_STATES = new Set(["PENDING", "APPROVED", "CANCELLED"]);

export function normalizeLifecycleState(value) {
  return VALID_STATES.has(value) ? value : null;
}

export function canEditCreatorMutation(input) {
  const state = normalizeLifecycleState(input.state);
  if (!state || state === "CANCELLED" || !input.createdBy) return false;
  if (input.isAdmin) return true;
  return Boolean(input.actorId && input.actorId === input.createdBy && state === "PENDING");
}

export function canCancelCreatorMutation(input) {
  return canEditCreatorMutation(input);
}
export function taskLifecycleState(task) {
  const status = task?.status;
  if (status === "cancelled") return "CANCELLED";
  if (status === "done") return "APPROVED";
  if (["new", "in_progress", "blocked", "waiting", "pending_review", "rejected"].includes(status)) return "PENDING";
  return null;
}

export function leaveLifecycleState(status) {
  if (status === "cancelled") return "CANCELLED";
  if (status === "approved") return "APPROVED";
  if (status === "pending" || status === "rejected") return "PENDING";
  return null;
}

export function personalScheduleLifecycleState(status) {
  if (status === "CANCELLED" || status === "cancelled") return "CANCELLED";
  if (status === "APPROVED" || status === "approved") return "APPROVED";
  if (status === "PENDING_APPROVAL" || status === "pending") return "PENDING";
  return null;
}
