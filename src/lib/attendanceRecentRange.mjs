const DAY_MS = 86_400_000;

const parseDate = (value) => new Date(`${value}T12:00:00Z`);
const formatDate = (date) => date.toISOString().slice(0, 10);

export const clampAttendanceEndDate = (requestedEnd, today) => requestedEnd > today ? today : requestedEnd;

export const recentAttendanceDates = (today, offset = 0, limit = 10) => {
  const end = parseDate(today);
  const start = new Date(end.getTime() - (offset + limit - 1) * DAY_MS);
  return Array.from({ length: limit }, (_, index) => formatDate(new Date(start.getTime() + (limit - 1 - index) * DAY_MS)));
};

export const recentAttendanceRange = (today, offset = 0, limit = 10) => {
  const dates = recentAttendanceDates(today, offset, limit);
  return { start: dates.at(-1), end: dates[0], dates };
};