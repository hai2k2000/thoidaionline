/** @param {unknown} value */
export function csvCell(value) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** @param {string} month YYYY-MM @param {string[]} gridDays */
export function exportWorkdays(month, gridDays) {
  return gridDays.filter((day) => day.startsWith(month) && ![0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay()));
}

// Day-of-month only ("01"); "01/10" would be auto-converted to a date by Excel.
/** @param {string} workDate YYYY-MM-DD */
export function exportDayHeader(workDate) {
  return workDate.slice(8, 10);
}

/** @param {string} month YYYY-MM */
export function exportTitle(month) {
  return `BẢNG CHẤM CÔNG THÁNG ${month.slice(5, 7)}/${month.slice(0, 4)}`;
}

/** @param {{ code: string, workday: number } | undefined} cell */
export function exportCellValue(cell) {
  if (!cell) return "";
  switch (cell.code) {
    case "future":
    case "weekend": return "";
    case "leave_full": return "P";
    case "leave_half": return "½P";
    case "business": return "CT";
    case "online": return "O";
    case "absent": return 0;
    default: return cell.workday;
  }
}

/**
 * @param {string} month
 * @param {{ days: string[], rows: Array<{ staffId: string, name: string, departmentName: string, cells: Array<{ date: string, code: string, workday: number }> }> }} grid
 * @param {Array<{ user_id: string, work_date: string, note?: string | null }>} monthlyRows
 */
export function buildAttendanceExportCsv(month, grid, monthlyRows) {
  const days = exportWorkdays(month, grid.days);
  const notesByStaff = new Map();
  for (const row of monthlyRows) {
    if (!row.work_date?.startsWith(month)) continue;
    notesByStaff.set(row.user_id, [...(notesByStaff.get(row.user_id) ?? []), row.note ?? ""]);
  }
  const headers = ["STT", "Họ tên", "Phòng", ...days.map(exportDayHeader), "Tổng công", "Nghỉ có phép", "Nghỉ không phép", "Công tác", "Đi muộn", "Về sớm", "Thiếu giờ ra"];
  const lines = [csvCell(exportTitle(month)), "", headers.map(csvCell).join(",")];
  grid.rows.forEach((person, index) => {
    const cellsByDate = new Map(person.cells.map((cell) => [cell.date, cell]));
    const monthCells = days.map((day) => cellsByDate.get(day));
    const count = (codes) => monthCells.filter((cell) => cell && codes.includes(cell.code)).length;
    const notes = notesByStaff.get(person.staffId) ?? [];
    const noted = (text) => notes.filter((note) => note.includes(text)).length;
    const total = monthCells.reduce((sum, cell) => sum + (cell?.workday ?? 0), 0);
    lines.push([
      index + 1, person.name, person.departmentName, ...monthCells.map(exportCellValue),
      total, count(["leave_full", "leave_half"]), count(["absent"]), count(["business"]),
      noted("Đi muộn"), noted("Về sớm"), noted("Thiếu giờ ra"),
    ].map(csvCell).join(","));
  });
  return `﻿${lines.join("\n")}\n`;
}
