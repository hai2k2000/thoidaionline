export type CanonicalTaskType = "assigned" | "personal";

export type CanonicalTaskStatus =
  | "new"
  | "in_progress"
  | "blocked"
  | "waiting"
  | "pending_review"
  | "done"
  | "rejected"
  | "cancelled";

export type TaskCompatibilityInput = {
  task_type: CanonicalTaskType | null;
  plan_period: "ad_hoc" | "daily" | "weekly" | "monthly";
  self_claimable: boolean;
  owner_id: string | null;
  assignee_id: string | null;
  task_assignees?: Array<{ assignment_role: string }> | null;
};

export type TaskCompatibility = {
  compatibility_task_type: CanonicalTaskType | null;
  legacy_read_only: boolean;
};

export function resolveTaskCompatibility(
  task: TaskCompatibilityInput,
): TaskCompatibility {
  if (task.task_type !== null) {
    return {
      compatibility_task_type: task.task_type,
      legacy_read_only: false,
    };
  }

  const hasOwner = task.owner_id !== null
    || task.assignee_id !== null
    || (task.task_assignees ?? []).some(({ assignment_role }) =>
      assignment_role === "owner" || assignment_role === "assignee"
    );
  const compatibilityTaskType = task.plan_period === "ad_hoc"
    && !task.self_claimable
    ? "assigned"
    : ["daily", "weekly", "monthly"].includes(task.plan_period) && hasOwner
      ? "personal"
      : null;

  return {
    compatibility_task_type: compatibilityTaskType,
    legacy_read_only: true,
  };
}