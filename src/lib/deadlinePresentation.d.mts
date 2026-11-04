export type DeadlineTask = {
  status?: string;
  due_date: string | null;
  due_time?: string | null;
  completion_submitted_at?: string | null;
  completed_at?: string | null;
};
export type DeadlineState = "cancelled" | "no_deadline" | "submitted_on_time" | "submitted_late" | "on_time" | "due_soon" | "overdue";
export function classifyTaskDeadline(task: DeadlineTask, now?: Date): DeadlineState;
export function deadlineLabel(state: string): string | null;
export function deadlineTone(state: string): string;
