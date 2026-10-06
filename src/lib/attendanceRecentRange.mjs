const parseDate = (value) => new Date(`${value}T12:00:00Z`);
const formatDate = (date) => date.toISOString().slice(0, 10);

export const isAttendanceBusinessDate = (value) => {
  const day = parseDate(value).getUTCDay();
  return day !== 0 && day !== 6;
};

export const filterBusinessAttendanceRows = (rows) =>
  rows.filter((row) => isAttendanceBusinessDate(row.work_date));

export const clampAttendanceEndDate = (requestedEnd, today) => requestedEnd > today ? today : requestedEnd;

export const recentAttendanceDates = (today, offset = 0, limit = 10) => {
  const dates = [];
  const cursor = parseDate(today);
  let skipped = 0;
  while (dates.length < limit) {
    const value = formatDate(cursor);
    if (isAttendanceBusinessDate(value)) {
      if (skipped >= offset) dates.push(value);
      else skipped += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates;
};

export const recentAttendanceRange = (today, offset = 0, limit = 10) => {
  const dates = recentAttendanceDates(today, offset, limit);
  return { start: dates.at(-1), end: dates[0], dates };
};
