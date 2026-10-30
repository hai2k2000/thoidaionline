import { writeXlsx } from "./xlsxWriter.mjs";

export function exportDayHeader(workDate) { return workDate.slice(8, 10); }
export function exportTitle(month) { return `BẢNG CHẤM CÔNG THÁNG ${month.slice(5, 7)}/${month.slice(0, 4)}`; }
const daysInMonth = (month) => { const [year, monthNumber] = month.split("-").map(Number); const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate(); return Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`); };
const weekday = (date) => ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][new Date(`${date}T12:00:00Z`).getUTCDay()];
const styleForCode = (code) => ({ present: "present", incomplete: "incomplete", absent: "absent", leave_full: "leave", leave_half: "leave", online: "online", business: "business", weekend: "weekend", future: "future", forgot_card: "forgot", forgot_swipe: "forgot" }[code] ?? "default");
const symbolForCell = (cell) => cell?.symbol ?? ({ present: "✓", incomplete: "✓", absent: "✗", leave_full: "P", leave_half: "½P", online: "O", business: "CT", weekend: "·", future: "", forgot_card: "QT", forgot_swipe: "QQ" }[cell?.code] ?? "");
export function exportWorkdays(month, gridDays) { return gridDays.filter((day) => day.startsWith(month) && ![0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay())); }
export function exportCellValue(cell) { return symbolForCell(cell); }
const columnNameFor = (index) => { let value = index; let out = ""; while (value > 0) { value -= 1; out = String.fromCharCode(65 + value % 26) + out; value = Math.floor(value / 26); } return out; };

export function buildAttendanceExportSheet(month, grid, monthlyRows = []) {
  const days = daysInMonth(month);
  const totalHeaders = ["Tổng công", "Nghỉ có phép", "Nghỉ không phép", "Công tác", "Quên thẻ/quẹt thẻ", "Đi muộn", "Về sớm", "Thiếu giờ ra"];
  const headers = ["STT", "Nhân sự", "Phòng", ...days.map(exportDayHeader), ...totalHeaders];
  const rows = [
    { height: 28, cells: [{ value: exportTitle(month), style: "title" }, ...Array(headers.length - 1).fill({ value: "" })] },
    { cells: headers.map(() => ({ value: "" })) },
    { height: 22, cells: headers.map((value) => ({ value, style: "header" })) },
    { height: 18, cells: ["", "", "", ...days.map(weekday), ...totalHeaders.map(() => "")].map((value) => ({ value, style: "weekday" })) },
  ];
  const notesByStaff = new Map();
  for (const row of monthlyRows) if (row.user_id && row.work_date?.startsWith(month)) notesByStaff.set(row.user_id, [...(notesByStaff.get(row.user_id) ?? []), row.note ?? ""]);
  for (const [index, person] of (grid.rows ?? []).entries()) {
    const byDate = new Map((person.cells ?? []).map((cell) => [cell.date, cell]));
    const monthCells = days.map((day) => byDate.get(day) ?? { date: day, code: "future", symbol: "", workday: 0 });
    const notes = notesByStaff.get(person.staffId) ?? [];
    const count = (codes) => monthCells.filter((cell) => codes.includes(cell.code)).length;
    const noteCount = (text) => notes.filter((note) => String(note).normalize("NFC").toLocaleLowerCase("vi-VN").includes(text)).length;
    const total = monthCells.reduce((sum, cell) => sum + Number(cell.workday ?? 0), 0);
    const values = [index + 1, person.name, person.departmentName, ...monthCells.map(symbolForCell), total, count(["leave_full", "leave_half"]), count(["absent"]), count(["business"]), count(["forgot_card", "forgot_swipe"]), noteCount("đi muộn"), noteCount("về sớm"), noteCount("thiếu giờ ra")];
    rows.push({ cells: values.map((value, cellIndex) => ({ value, style: cellIndex >= 3 && cellIndex < 3 + days.length ? styleForCode(monthCells[cellIndex - 3].code) : cellIndex === 0 || cellIndex >= 3 + days.length ? "centered" : "bordered" })) });
  }
  rows.push({ cells: ["Chú giải", "✓ Đi làm", "✓ Thiếu giờ/đi muộn", "✗ Vắng", "P / ½P Nghỉ phép", "O Online", "CT Công tác/Sự kiện", "· Cuối tuần", "QT = Quên thẻ", "QQ = Quên quẹt thẻ"].map((value) => ({ value, style: "bordered" })) });
  return { name: `Chấm công ${month}`, columns: [{ width: 5 }, { width: 24 }, { width: 18 }, ...days.map(() => ({ width: 4.5 })), ...totalHeaders.map(() => ({ width: 12 }))], rows, merges: [`A1:${columnNameFor(headers.length)}1`], freeze: { rows: 4, columns: 3 } };
}

export function buildAttendanceExportXlsx(month, grid, monthlyRows = []) { return writeXlsx(buildAttendanceExportSheet(month, grid, monthlyRows)); }
