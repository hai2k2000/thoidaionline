const LEGACY_UNKNOWN_LABEL = "Không xác định (dữ liệu cũ)";
const hasIdentity = (value) => typeof value === "string" && value.trim().length > 0;

/** Resolve the user-facing source without changing the stored assignment origin. */
export function getAssignmentSourceDisplay(task) {
  if (task.assignment_source === "self_registered") return "Tự đăng ký";
  if (task.assignment_source === "leadership_assigned") return "Lãnh đạo giao";

  const isLegacySelfExecuted = task.assignment_source === "legacy_unknown"
    && hasIdentity(task.created_by)
    && hasIdentity(task.owner_id)
    && hasIdentity(task.assignee_id)
    && task.created_by === task.owner_id
    && task.owner_id === task.assignee_id;

  return isLegacySelfExecuted ? "Tự thực hiện" : LEGACY_UNKNOWN_LABEL;
}

export function isSelfCreatedTask(task) {
  return hasIdentity(task.created_by)
    && hasIdentity(task.owner_id)
    && hasIdentity(task.assignee_id)
    && task.created_by === task.owner_id
    && task.owner_id === task.assignee_id;
}

/**
 * Assignment approval is the waiting -> in_progress transition.
 * Completion approval uses a different transition and is intentionally ignored.
 */
export function selectAssignmentApprovalActor(events) {
  return (events ?? [])
    .filter((event) => event.from_status === "waiting" && event.to_status === "in_progress")
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))[0] ?? null;
}

export function resolveDisplayedAssigner(task) {
  const creator = task.created_by_user?.full_name?.trim() || "—";
  const approver = task.assignment_approver?.full_name?.trim() || null;

  const selfCreated = isSelfCreatedTask(task);
  if (task.assignment_source === "leadership_assigned" || !selfCreated) {
    return { label: "Người giao việc", value: creator };
  }
  if (hasIdentity(task.assignment_approved_by) && approver) {
    return { label: "Người giao việc", value: approver };
  }
  if (hasIdentity(task.assignment_approved_by)) {
    return { label: "Người giao việc", value: creator };
  }
  if (task.assignment_source === "self_registered") {
    return { label: "Người giao việc", value: "—" };
  }
  return { label: "Người giao việc", value: creator };
}
