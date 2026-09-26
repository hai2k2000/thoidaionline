import {
  getDepartmentPlanPeriod,
  isDepartmentPlanPeriodType,
  type DepartmentPlanPeriodType,
} from "./departmentPlanPeriod";

export const shiftDepartmentPlanStart = (
  periodType: DepartmentPlanPeriodType,
  periodStart: string,
  amount: number,
) => {
  const [year, month, day] = periodStart.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (periodType === "weekly") date.setUTCDate(date.getUTCDate() + amount * 7);
  else date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 10);
};

export const formatDepartmentPlanPeriod = (
  periodType: DepartmentPlanPeriodType,
  periodStart: string,
  periodEnd: string,
  locale = "vi-VN",
) => {
  if (periodType === "monthly") {
    const [year, month] = periodStart.split("-");
    return `Tháng ${month}/${year}`;
  }
  const formatter = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(`${periodStart}T00:00:00Z`))} - ${formatter.format(new Date(`${periodEnd}T00:00:00Z`))}`;
};

export const canonicalPeriodFromQuery = (
  period: unknown,
  start: unknown,
  now = new Date(),
) => {
  const periodType: DepartmentPlanPeriodType = isDepartmentPlanPeriodType(period) ? period : "weekly";
  const requestedStart = typeof start === "string" && start ? start : null;
  try {
    return getDepartmentPlanPeriod(periodType, requestedStart, now);
  } catch {
    return getDepartmentPlanPeriod(periodType, null, now);
  }
};

export const departmentPlanUrl = (
  periodType: DepartmentPlanPeriodType,
  periodStart: string,
  departmentId?: string | null,
) => {
  const query = new URLSearchParams({ period: periodType, start: periodStart });
  if (departmentId) query.set("departmentId", departmentId);
  return `/planning/department?${query.toString()}`;
};
