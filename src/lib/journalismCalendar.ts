export const CALENDAR_VIEWS = ["day", "week", "month"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];
export const CALENDAR_PUBLICATION_STATUSES = ["not_published", "scheduled", "published", "withdrawn"] as const;
export type CalendarPublicationStatus = (typeof CALENDAR_PUBLICATION_STATUSES)[number];
export type CalendarStatus = "unplanned" | "overdue" | "scheduled" | "published" | "withdrawn";

export type JournalismCalendarQuery = {
  view: CalendarView;
  anchorDate: string;
  reporterId: string | null;
  publicationStatus: CalendarPublicationStatus | null;
  topicId: string | null;
  seriesId: string | null;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (value: string) => DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export function calendarRange(view: CalendarView, anchorDate: string) {
  const anchor = new Date(`${anchorDate}T00:00:00Z`);
  if (view === "day") return { from: anchorDate, to: anchorDate };
  if (view === "month") {
    const from = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    const to = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
    return { from: isoDate(from), to: isoDate(to) };
  }
  const mondayOffset = (anchor.getUTCDay() + 6) % 7;
  const from = new Date(anchor);
  from.setUTCDate(from.getUTCDate() - mondayOffset);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 6);
  return { from: isoDate(from), to: isoDate(to) };
}

export function classifyCalendarTask(
  task: { plannedPublicationAt: string | null; publicationStatus: CalendarPublicationStatus },
  today: string,
): CalendarStatus {
  if (task.publicationStatus === "published") return "published";
  if (task.publicationStatus === "withdrawn") return "withdrawn";
  if (!task.plannedPublicationAt) return "unplanned";
  if (task.plannedPublicationAt.slice(0, 10) < today) return "overdue";
  return "scheduled";
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const normalizeToken = (value: string | null) => value && UUID_PATTERN.test(value.trim()) ? value.trim() : null;

export function parseCalendarQuery(params: URLSearchParams): JournalismCalendarQuery {
  const requestedView = params.get("view");
  const view = CALENDAR_VIEWS.includes(requestedView as CalendarView) ? requestedView as CalendarView : "month";
  const requestedDate = params.get("date") ?? "";
  const anchorDate = validDate(requestedDate) ? requestedDate : new Date().toISOString().slice(0, 10);
  const requestedStatus = params.get("status");
  const publicationStatus = CALENDAR_PUBLICATION_STATUSES.includes(requestedStatus as CalendarPublicationStatus)
    ? requestedStatus as CalendarPublicationStatus
    : null;
  return {
    view,
    anchorDate,
    reporterId: normalizeToken(params.get("reporter")),
    publicationStatus,
    topicId: normalizeToken(params.get("topic")),
    seriesId: normalizeToken(params.get("series")),
  };
}

export function canViewCalendar(actor: { roleCode?: string | null; departmentCode?: string | null }) {
  return (["admin", "tong_bien_tap", "pho_tong_bien_tap"].includes(actor.roleCode ?? "") || actor.departmentCode === "editorial")
    && ["admin", "tong_bien_tap", "pho_tong_bien_tap", "truong_phong", "pho_truong_phong", "phu_trach_phong_bien_tap", "phu_trach_phong_phong_vien", "phu_trach_phong_tri_su", "phong_vien"].includes(actor.roleCode ?? "");
}
