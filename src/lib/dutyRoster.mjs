export const DUTY_POSITIONS = ["Biên tập và xuất bản", "Biên tập bước 2", "Biên tập bước 1", "Phóng viên"];

export function monthDays(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, "0")}`;
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    return { date, weekday, assignments: Object.fromEntries(DUTY_POSITIONS.map((position) => [position, ""])) };
  });
}

export function completeRows(days, positions = DUTY_POSITIONS) {
  return days.filter((day) => positions.every((position) => day.assignments?.[position])).map((day) => ({
    date: day.date,
    assignments: Object.fromEntries(positions.map((position) => [position, day.assignments[position]])),
  }));
}
