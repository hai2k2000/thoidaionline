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
