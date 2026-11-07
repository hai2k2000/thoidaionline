import { classifyTaskDeadline } from "./deadlinePresentation.mjs";
import { deskCopy } from "./deskHomeCopy.mjs";

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const DAY_MS = 86400000;

export function fillCopy(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}

function vietnamParts(now) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function vietnamToday(now = new Date()) {
  const parts = vietnamParts(now);
  return parts.year + "-" + parts.month + "-" + parts.day;
}

export function deskGreeting(fullName, now = new Date()) {
  const hour = Number(vietnamParts(now).hour);
  const prefix = hour < 11 ? deskCopy.greetingMorning : hour < 13 ? deskCopy.greetingNoon : hour < 18 ? deskCopy.greetingAfternoon : deskCopy.greetingEvening;
  const name = String(fullName ?? "").trim().split(/\s+/).filter(Boolean).pop();
  return prefix + (name ? ", " + name : "");
}

export function deskDateLabel(now = new Date()) {
  const parts = vietnamParts(now);
  const weekday = deskCopy.weekdays[new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))).getUTCDay()];
  return weekday + ", " + parts.day + "/" + parts.month + "/" + parts.year;
}

function dateDiff(from, to) {
  return Math.round((Date.parse(from + "T00:00:00Z") - Date.parse(to + "T00:00:00Z")) / DAY_MS);
}

export function buildDeskTodayItems(rows, now = new Date()) {
  const today = vietnamToday(now);
  const items = [];
  for (const row of rows ?? []) {
    if (!row.due_date) continue;
    const state = classifyTaskDeadline(row, now);
    const days = dateDiff(row.due_date, today);
    if (state !== "overdue" && days > 3) continue;
    const deskState = state === "overdue" ? "overdue" : days === 0 ? "today" : "soon";
    const label = state === "overdue" ? (days < 0 ? fillCopy(deskCopy.overdueDays, { n: Math.abs(days) }) : deskCopy.overdueToday) : days === 0 ? deskCopy.dueToday : fillCopy(deskCopy.dueInDays, { n: days });
    items.push({ id: row.id, title: row.title, href: "/tasks/" + row.id, state: deskState, label, dueDate: row.due_date, dueTime: row.due_time ?? null });
  }
  items.sort((a, b) => ({ overdue: 0, today: 1, soon: 2 }[a.state] - { overdue: 0, today: 1, soon: 2 }[b.state] || a.dueDate.localeCompare(b.dueDate) || (a.dueTime ?? "23:59").localeCompare(b.dueTime ?? "23:59") || String(a.title).localeCompare(String(b.title), "vi")));
  const overdueCount = items.filter((item) => item.state === "overdue").length;
  const todayCount = items.filter((item) => item.state === "today").length;
  return { items: items.map(({ id, title, href, state, label }) => ({ id, title, href, state, label })), overdueCount, todayCount };
}

export function mergeDeskApprovalItems(lists) {
  const seen = new Set();
  return (lists ?? []).flatMap((list) => list ?? []).filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function selectDeskNotifications(items, limit = 5) {
  return (items ?? []).filter((item) => item.kind !== "deadline").sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, limit);
}

export function isDeskScheduleVisible(row) {
  return !["REJECTED", "CANCELLED"].includes(row.approval_status) && row.event_status !== "CANCELLED";
}

export function pickDeskShortcuts(navigation) {
  const wanted = [["assign", deskCopy.shortcutAssign], ["weekly-report", deskCopy.shortcutWeeklyReport], ["attendance", deskCopy.shortcutAttendance], ["duty-schedule", deskCopy.shortcutDuty], ["work-schedule", deskCopy.shortcutSchedule], ["database", deskCopy.shortcutDatabase]];
  return wanted.flatMap(([id, label]) => {
    const item = navigation?.primary?.find((entry) => entry.id === id);
    return item ? [{ id: item.id, href: item.href, label }] : [];
  });
}
