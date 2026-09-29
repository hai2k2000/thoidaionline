export type DepartmentPlanPeriodType = "weekly" | "monthly";

export type DepartmentPlanPeriod = {
  periodType: DepartmentPlanPeriodType;
  periodStart: string;
  periodEnd: string;
};

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const dateParts = (value: string) => {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? { year, month, day }
    : null;
};

const iso = (date: Date) => date.toISOString().slice(0, 10);

const localToday = (now: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now).reduce<Record<string, string>>((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export function canonicalizePeriodStart(
  periodType: DepartmentPlanPeriodType,
  requestedStart?: string | null,
  now = new Date(),
): string {
  const raw = requestedStart || localToday(now);
  const parts = dateParts(raw);
  if (!parts) throw new Error("invalid period start");
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (periodType === "weekly") {
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - mondayOffset);
    return iso(date);
  }
  if (periodType === "monthly") {
    date.setUTCDate(1);
    return iso(date);
  }
  throw new Error("invalid period type");
}

export function getDepartmentPlanPeriod(
  periodType: DepartmentPlanPeriodType,
  requestedStart?: string | null,
  now = new Date(),
): DepartmentPlanPeriod {
  const periodStart = canonicalizePeriodStart(periodType, requestedStart, now);
  const parts = dateParts(periodStart)!;
  const start = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const end = new Date(start);
  if (periodType === "weekly") end.setUTCDate(end.getUTCDate() + 6);
  else end.setUTCMonth(end.getUTCMonth() + 1, 0);
  return { periodType, periodStart, periodEnd: iso(end) };
}

export const isDepartmentPlanPeriodType = (value: unknown): value is DepartmentPlanPeriodType => value === "weekly" || value === "monthly";
