const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const iso = (date) => date.toISOString().slice(0, 10);
const parseDate = (value) => new Date(`${value}T12:00:00Z`);

export function scheduleRange(view, anchor) {
  if (!DATE_PATTERN.test(anchor)) throw new Error("invalid date");
  const date = new Date(`${anchor}T12:00:00Z`);
  if (Number.isNaN(date.valueOf())) throw new Error("invalid date");
  if (view === "day") return { from: anchor, to: anchor };
  if (view === "week") {
    const day = date.getUTCDay(); const monday = new Date(date); monday.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate() + 6);
    return { from: iso(monday), to: iso(sunday) };
  }
  if (view === "month") {
    const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
    return { from: iso(first), to: iso(last) };
  }
  throw new Error("invalid view");
}

export function scheduleCalendarDates(view, from, to) {
  if (view === "day") return [from];
  const start = parseDate(from);
  const end = parseDate(to);
  const dates = [];
  if (view === "month") {
    const leading = (start.getUTCDay() + 6) % 7;
    for (let index = 0; index < leading; index += 1) dates.push(null);
  }
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(iso(cursor));
  }
  if (view === "month") {
    while (dates.length % 7 !== 0) dates.push(null);
  }
  return dates;
}
