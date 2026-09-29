import type { DepartmentPlanItemRow } from "@/lib/departmentPlanRepository";

export type ReportWorkStatus = DepartmentPlanItemRow["work_status"];
export type ReportAssignmentState = DepartmentPlanItemRow["assignment_state"];

export const REPORT_WORK_STATUSES: readonly ReportWorkStatus[] = [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
];

export const REPORT_ASSIGNMENT_STATES: readonly ReportAssignmentState[] = [
  "unassigned",
  "department_wide",
  "assigned",
];

export type DepartmentPlanReportFilters = {
  employeeId: string | null;
  workStatus: ReportWorkStatus | null;
  assignmentState: ReportAssignmentState | null;
};

export type DepartmentPlanReportMetrics = {
  total: number;
  completed: number;
  inProgress: number;
  planned: number;
  overdue: number;
  unassigned: number;
  departmentWide: number;
};

export type DepartmentPlanReportItem = DepartmentPlanItemRow & {
  assignee_name: string | null;
};

const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

export function isReportWorkStatus(value: unknown): value is ReportWorkStatus {
  return REPORT_WORK_STATUSES.includes(value as ReportWorkStatus);
}

export function isReportAssignmentState(value: unknown): value is ReportAssignmentState {
  return REPORT_ASSIGNMENT_STATES.includes(value as ReportAssignmentState);
}

export function localDateInTimeZone(
  value: Date,
  timeZone = VIETNAM_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value).reduce<Record<string, string>>((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isDepartmentPlanItemOverdue(
  item: Pick<DepartmentPlanItemRow, "due_at" | "work_status">,
  effectiveNow = new Date(),
): boolean {
  if (!item.due_at || item.work_status === "completed" || item.work_status === "cancelled") {
    return false;
  }
  const dueAt = new Date(item.due_at);
  if (Number.isNaN(dueAt.getTime())) return false;
  return localDateInTimeZone(dueAt) < localDateInTimeZone(effectiveNow);
}

export function filterDepartmentPlanReportItems(
  items: DepartmentPlanItemRow[],
  filters: DepartmentPlanReportFilters,
): DepartmentPlanItemRow[] {
  return items.filter((item) => (
    (!filters.employeeId || item.assignee_id === filters.employeeId)
    && (!filters.workStatus || item.work_status === filters.workStatus)
    && (!filters.assignmentState || item.assignment_state === filters.assignmentState)
  ));
}

export function calculateDepartmentPlanReportMetrics(
  items: DepartmentPlanItemRow[],
  effectiveNow = new Date(),
): DepartmentPlanReportMetrics {
  return items.reduce<DepartmentPlanReportMetrics>((metrics, item) => {
    metrics.total += 1;
    if (item.work_status === "completed") metrics.completed += 1;
    if (item.work_status === "in_progress") metrics.inProgress += 1;
    if (item.work_status === "planned") metrics.planned += 1;
    if (isDepartmentPlanItemOverdue(item, effectiveNow)) metrics.overdue += 1;
    if (item.assignment_state === "unassigned") metrics.unassigned += 1;
    if (item.assignment_state === "department_wide") metrics.departmentWide += 1;
    return metrics;
  }, {
    total: 0,
    completed: 0,
    inProgress: 0,
    planned: 0,
    overdue: 0,
    unassigned: 0,
    departmentWide: 0,
  });
}
