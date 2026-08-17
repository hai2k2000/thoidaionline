export type DeadlineTask = {
  due_date: string | null;
  completion_submitted_at: string | null;
};
export function classifyTaskDeadline(
  task: DeadlineTask,
  now?: Date,
): "no_deadline" | "on_time" | "due_soon" | "overdue";
