const toDate = (iso) => new Date(`${iso}T12:00:00Z`);
const toIso = (date) => date.toISOString().slice(0, 10);

export function mondayFirstWeek(iso) {
  const date = toDate(iso);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const cell = new Date(date);
    cell.setUTCDate(date.getUTCDate() + index);
    return toIso(cell);
  });
}

const isWeekend = (iso) => {
  const day = toDate(iso).getUTCDay();
  return day === 0 || day === 6;
};

export function buildOnlineWorkWeeks(from, to, rows) {
  const firstWeek = mondayFirstWeek(from);
  const lastWeek = mondayFirstWeek(to);
  const dates = [];
  const cursor = toDate(firstWeek[0]);
  const end = toDate(lastWeek[0]);
  while (cursor <= end) {
    dates.push(...mondayFirstWeek(toIso(cursor)));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  const byDate = new Map();
  for (const row of rows) {
    byDate.set(row.work_date, [...(byDate.get(row.work_date) ?? []), row]);
  }
  return Array.from({ length: dates.length / 7 }, (_, weekIndex) =>
    dates.slice(weekIndex * 7, weekIndex * 7 + 7).map((date) => ({
      date,
      assignments: isWeekend(date) ? [] : (byDate.get(date) ?? []),
      weekendLabel: isWeekend(date) ? 'Tất cả ban tiếng Anh' : null,
    })),
  );
}
