const DAY_MS = 86_400_000;
const labels = { submitted_on_time: "Nộp đúng hạn", submitted_late: "Nộp trễ", due_soon: "Sắp đến hạn", overdue: "Quá hạn", on_time: "Còn hạn", no_deadline: "Không có hạn" };
const submittedStatuses = new Set(["pending_review", "done"]);
const vietnamDate = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);

export function classifyTaskDeadline(task, now = new Date()) {
  if (task.status === "cancelled") return "cancelled";
  if (!task.due_date) return "no_deadline";
  const submittedAt = submittedStatuses.has(task.status) ? [task.completion_submitted_at, task.completed_at].find(value => value && Number.isFinite(Date.parse(value))) : null;
  if (submittedAt) {
    const due = task.due_time ? new Date(`${task.due_date}T${task.due_time}+07:00`) : new Date(`${task.due_date}T23:59:59.999+07:00`);
    return new Date(submittedAt) <= due ? "submitted_on_time" : "submitted_late";
  }
  const today = vietnamDate(now);
  if (task.due_date < today || (task.due_time && now > new Date(`${task.due_date}T${task.due_time}+07:00`))) return "overdue";
  const due = Date.parse(`${task.due_date}T00:00:00Z`);
  const current = Date.parse(`${today}T00:00:00Z`);
  return due - current <= 3 * DAY_MS ? "due_soon" : "on_time";
}

export const deadlineLabel = (state) => state === "cancelled" ? null : labels[state] ?? "Chưa xác định";
export const deadlineTone = (state) => state === "overdue" || state === "submitted_late" ? "text-red-700" : state === "due_soon" ? "text-amber-700" : state === "submitted_on_time" ? "text-emerald-700" : "text-slate-700";
