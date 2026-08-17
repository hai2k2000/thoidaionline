const DAY_MS = 86_400_000;

const vietnamDate = (value) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
}).format(value);

export function classifyTaskDeadline(task, now = new Date()) {
  if (!task.due_date) return "no_deadline";
  const completionDate = task.completion_submitted_at
    ? vietnamDate(new Date(task.completion_submitted_at))
    : null;
  if (completionDate) return completionDate <= task.due_date ? "on_time" : "overdue";
  const today = vietnamDate(now);
  if (task.due_date < today) return "overdue";
  const due = Date.parse(`${task.due_date}T00:00:00Z`);
  const current = Date.parse(`${today}T00:00:00Z`);
  return due - current <= 3 * DAY_MS ? "due_soon" : "on_time";
}
