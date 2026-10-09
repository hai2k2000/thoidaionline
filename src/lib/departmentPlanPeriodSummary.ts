import type { DepartmentPlanReportItem } from "@/lib/departmentPlanReport";

export type DepartmentPlanPeriodSummary = {
  plannedItems: DepartmentPlanReportItem[];
  spontaneousItems: DepartmentPlanReportItem[];
  completedItems: DepartmentPlanReportItem[];
  unfinishedItems: DepartmentPlanReportItem[];
  outstandingItems: DepartmentPlanReportItem[];
  longRunningItems: DepartmentPlanReportItem[];
  carryOverItems: DepartmentPlanReportItem[];
  recurringItems: DepartmentPlanReportItem[];
  continuationItems: DepartmentPlanReportItem[];
  nextPeriodItems: DepartmentPlanReportItem[];
  completionRate: number;
};

const isSpontaneous = (item: DepartmentPlanReportItem) => item.period_relation === "AUTO_ADDED_DURING_PERIOD";
const isCompleted = (item: DepartmentPlanReportItem) => item.completed_in_period === true || item.work_status === "completed";
const isUnfinished = (item: DepartmentPlanReportItem) => !isCompleted(item) && item.work_status !== "cancelled";

const uniqueByCanonicalTask = (items: DepartmentPlanReportItem[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.linked_task_id ? `task:${item.linked_task_id}` : `item:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function summarizeDepartmentPlanPeriod(items: DepartmentPlanReportItem[]): DepartmentPlanPeriodSummary {
  const uniqueItems = uniqueByCanonicalTask(items);
  const plannedItems = uniqueItems.filter((item) => !isSpontaneous(item));
  const spontaneousItems = uniqueItems.filter(isSpontaneous);
  const completedItems = plannedItems.filter(isCompleted);
  const unfinishedItems = plannedItems.filter(isUnfinished);
  const outstandingItems = uniqueItems.filter(isUnfinished);
  const longRunningItems = uniqueItems.filter((item) => item.period_relation === "LONG_RUNNING");
  const carryOverItems = uniqueItems.filter((item) => item.carry_forward === true);
  const recurringItems = uniqueItems.filter((item) => item.period_relation === "RECURRING");
  const continuationItems = uniqueByCanonicalTask([...longRunningItems, ...uniqueItems.filter((item) => item.period_relation === "CARRY_OVER"), ...carryOverItems]);
  const nextPeriodItems = uniqueByCanonicalTask([...carryOverItems, ...longRunningItems, ...recurringItems]);

  return {
    plannedItems,
    spontaneousItems,
    completedItems,
    unfinishedItems,
    outstandingItems,
    longRunningItems,
    carryOverItems,
    recurringItems,
    continuationItems,
    nextPeriodItems,
    completionRate: plannedItems.length ? Math.round((completedItems.length / plannedItems.length) * 100) : 0,
  };
}

export const departmentPlanRelationLabel = (item: DepartmentPlanReportItem) => {
  switch (item.period_relation) {
    case "LONG_RUNNING": return "Dài hạn";
    case "CARRY_OVER": return "Chuyển tiếp";
    case "RECURRING": return "Định kỳ";
    case "AUTO_ADDED_DURING_PERIOD": return "Phát sinh trong kỳ";
    case "IMPORTED": return "Import";
    default: return "Mới";
  }
};

export const departmentPlanResultText = (item: DepartmentPlanReportItem) => item.result_this_period?.trim() || item.period_end_state?.trim() || "—";
export const departmentPlanNextActionText = (item: DepartmentPlanReportItem) => item.carry_forward ? "Chuyển tiếp kỳ sau" : item.period_relation === "LONG_RUNNING" ? "Tiếp tục dài hạn" : item.period_relation === "RECURRING" ? "Lặp lại theo định kỳ" : "—";
export const departmentPlanWorkSourceLabel = (item: DepartmentPlanReportItem) => item.work_source === "leadership_assigned" ? "Giao phát sinh" : item.work_source === "self_registered" ? "Tự nhận – đã duyệt" : item.work_source === "department_plan" ? "Kế hoạch phòng" : item.work_source?.trim() || departmentPlanRelationLabel(item);
