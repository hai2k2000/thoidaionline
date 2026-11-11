export type EvaluationPerson = {
  id: string;
  full_name: string;
  department_id: string | null;
  department_name: string;
};
export type EvaluationTask = { id: string; title: string; status: string; due_date: string | null; assignee_id: string | null; completion_score?: unknown };
export type EvaluationAttendance = { user_id: string | null; status: string | null };
export type EvaluationViewer = { id: string; departmentId: string | null; orgScope: "all" | "department" | null };
export function completionTotal(value: unknown): number | null {
  const item = Array.isArray(value) ? value[0] : value;
  if (!item || typeof item !== "object") return null;
  const score = (item as { total_score?: unknown }).total_score;
  return typeof score === "number" ? score : null;
}
export function canViewAttendanceRate(viewer: EvaluationViewer, staff: { id: string; departmentId: string | null }): boolean {
  return viewer.id === staff.id || viewer.orgScope === "all" || (viewer.orgScope === "department" && viewer.departmentId !== null && viewer.departmentId === staff.departmentId);
}
export function buildEvaluationRows(input: { people: EvaluationPerson[]; tasks: EvaluationTask[]; attendance: EvaluationAttendance[]; attendanceAvailable: boolean; viewableTaskIds: ReadonlySet<string>; viewer: EvaluationViewer; today: string }) {
  return input.people.map((person) => {
    const own = input.tasks.filter((task) => task.assignee_id === person.id);
    const visible = own.filter((task) => input.viewableTaskIds.has(task.id));
    const done = own.filter((task) => task.status === "done");
    const returned = own.filter((task) => task.status === "rejected");
    const inProgress = own.filter((task) => ["in_progress", "blocked"].includes(task.status));
    const waiting = own.filter((task) => task.status === "pending_review");
    const overdue = own.filter((task) => task.status !== "done" && task.due_date !== null && task.due_date < input.today);
    const scores = own.map((task) => completionTotal(task.completion_score)).filter((score): score is number => score !== null);
    const logs = input.attendanceAvailable ? input.attendance.filter((log) => log.user_id === person.id) : [];
    const attendanceRate = canViewAttendanceRate(input.viewer, { id: person.id, departmentId: person.department_id }) && logs.length ? Math.round(logs.filter((log) => ["present", "late"].includes((log.status ?? "").toLowerCase())).length * 1000 / logs.length) / 10 : null;
    const score = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) * 100) / 100 : null;
    return { id: person.id, name: person.full_name, department: person.department_name, total: own.length, done: done.length, returned: returned.length, inProgress: inProgress.length, waiting: waiting.length, overdue: overdue.length, attendanceRate, score, tasks: visible.map((task) => ({ id: task.id, title: task.title, status: task.status, dueDate: task.due_date, score: completionTotal(task.completion_score) })), hiddenTaskCount: own.length - visible.length };
  });
}
