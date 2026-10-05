import type { AuthorizationActor } from "@/lib/authorization";

export type WorkReportPeriod = "week" | "month" | "range";
export type WorkReportSource = "assigned" | "department_plan" | "report_only";
export type WorkReportRow = { id: string; title: string; source: WorkReportSource; sourceLabel: string; status: string; departmentId: string | null; departmentName: string | null; assigneeId: string | null; assigneeName: string | null; ownerName: string | null; reviewerName: string | null; startDate: string | null; dueDate: string | null; completedAt: string | null; description: string | null; reportNotes: string | null; workflowType: string };

export type WorkReportEmployee = { id: string; full_name: string; department_id: string; username?: string | null; roles?: { code?: string | null } | Array<{ code?: string | null }> | null };
export function isWorkReportEmployeeVisible(employee: WorkReportEmployee, excludeEmployeeId?: string | null) {
  const role = (Array.isArray(employee.roles) ? employee.roles[0]?.code : employee.roles?.code)?.trim().toLowerCase() ?? "";
  const username = employee.username?.trim().toLowerCase() ?? "";
  return role !== "admin" && username !== "admin" && employee.id !== (excludeEmployeeId ?? null);
}

const TBT_ROLES = new Set(["admin", "tong_bien_tap", "tbt_read_only"]);
export function canViewWorkReport(actor: Pick<AuthorizationActor, "roleCode" | "departmentId" | "isDepartmentManager">, departmentId: string) { return TBT_ROLES.has(actor.roleCode) || (actor.roleCode === "truong_phong" && actor.isDepartmentManager === true && actor.departmentId === departmentId); }
export function resolveWorkReportDepartment(actor: Pick<AuthorizationActor, "roleCode" | "departmentId" | "isDepartmentManager">, requested?: string | null) { if (TBT_ROLES.has(actor.roleCode)) return requested || actor.departmentId; if (actor.roleCode === "truong_phong" && actor.isDepartmentManager && actor.departmentId) return requested && requested !== actor.departmentId ? null : actor.departmentId; return null; }
export function sourceForTask(task: { workflow_type?: string | null; assignment_source?: string | null }): WorkReportSource { return task.workflow_type === "REPORT_ONLY" ? "report_only" : task.assignment_source === "department_plan" ? "department_plan" : "assigned"; }
export const sourceLabel = (source: WorkReportSource) => ({ assigned: "Được giao", department_plan: "Kế hoạch phòng", report_only: "Việc phát sinh" }[source]);
export function periodBounds(period: WorkReportPeriod, anchor?: string | null, end?: string | null) { const valid = (v?: string | null) => /^\d{4}-\d{2}-\d{2}$/.test(v ?? ""); const date = valid(anchor) ? new Date(`${anchor}T12:00:00+07:00`) : new Date(); const iso = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(d); if (period === "range" && valid(anchor) && valid(end)) return { from: anchor!, to: end! }; if (period === "month") { const from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 5)); const to = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 5)); return { from: iso(from), to: iso(to) }; } const day = date.getUTCDay() || 7; const from = new Date(date); from.setUTCDate(date.getUTCDate() - day + 1); const to = new Date(from); to.setUTCDate(from.getUTCDate() + 6); return { from: iso(from), to: iso(to) }; }
