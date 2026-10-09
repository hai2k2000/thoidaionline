export const DEFAULT_PERSONAL_QUICK_REPORT_PAGE_SIZE = 50;
export const MAX_PERSONAL_QUICK_REPORT_ROWS = 2000;

export type PersonalQuickReportPeriod = "week" | "month" | "range";
export type PersonalQuickReportBounds = { from: string; to: string };
export type PersonalQuickReportRow = {
  id: string;
  title: string;
  description: string | null;
  report_work_date: string | null;
  start_date: string | null;
  completion_date: string | null;
  report_notes: string | null;
  status: string;
  workflow_type: string | null;
  owner_id: string | null;
  created_by: string | null;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

const isoDate = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: VIETNAM_TIME_ZONE }).format(date);
const validDate = (value: string | null | undefined): value is string => Boolean(value && DATE_PATTERN.test(value));

export function personalQuickReportPeriodBounds(period: PersonalQuickReportPeriod, anchor?: string | null, end?: string | null): PersonalQuickReportBounds {
  const base = validDate(anchor) ? new Date(`${anchor}T12:00:00+07:00`) : new Date();
  if (period === "range" && validDate(anchor) && validDate(end) && anchor <= end) return { from: anchor, to: end };
  if (period === "month") {
    const from = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1, 5));
    const to = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0, 5));
    return { from: isoDate(from), to: isoDate(to) };
  }
  const day = base.getUTCDay() || 7;
  const from = new Date(base);
  from.setUTCDate(base.getUTCDate() - day + 1);
  const to = new Date(from);
  to.setUTCDate(from.getUTCDate() + 6);
  return { from: isoDate(from), to: isoDate(to) };
}

export function filterPersonalQuickReports(rows: PersonalQuickReportRow[], actorId: string, bounds: PersonalQuickReportBounds) {
  return rows.filter((row) => row.workflow_type === "REPORT_ONLY" && row.owner_id === actorId && Boolean(row.report_work_date) && row.report_work_date! >= bounds.from && row.report_work_date! <= bounds.to);
}

export function personalQuickReportMetrics(rows: PersonalQuickReportRow[]) {
  return {
    total: rows.length,
    completed: rows.filter((row) => row.status === "done").length,
    inProgress: rows.filter((row) => row.status === "in_progress").length,
    unfinished: rows.filter((row) => row.status !== "done").length,
  };
}

export const personalQuickReportStatusLabel = (status: string) => ({ done: "Hoàn thành", in_progress: "Đang thực hiện", cancelled: "Đã hủy" }[status] ?? status);
