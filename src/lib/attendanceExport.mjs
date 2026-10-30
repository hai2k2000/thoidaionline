import { writeXlsx } from "./xlsxWriter.mjs";

const columnNameFor = (index) => { let value = index; let out = ""; while (value > 0) { value -= 1; out = String.fromCharCode(65 + value % 26) + out; value = Math.floor(value / 26); } return out; };
const daysInMonth = (month) => { const [year, monthNumber] = month.split("-").map(Number); const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate(); return Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`); };
export function countBusinessDays(month) { return daysInMonth(month).filter((date) => ![0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay())).length; }
export function exportDayHeader(workDate) { return Number(workDate.slice(8, 10)); }
export function exportTitle(month) { return `BẢNG CHẤM CÔNG THÁNG ${month.slice(5, 7)}/${month.slice(0, 4)}`; }
export function exportWorkdays(month, gridDays) { return gridDays.filter((day) => day.startsWith(month) && ![0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay())); }
const symbolForCell = (cell) => ({ present: 1, incomplete: Number(cell?.workday) || "", absent: "", leave_full: "P", leave_half: "½P", online: "OL", business: "CT", event: "SK", weekend: "", future: "", forgot_card: "QT", forgot_swipe: "QQ" }[cell?.code] ?? "");
export function exportCellValue(cell) { return symbolForCell(cell); }
const styleForCode = () => "day";

// Owner order: Tổng biên tập, Phó TBT, trưởng phòng, then Phòng Nội dung, Truyền thông, Tổng hợp.
const LEADER_RANK = { tong_bien_tap: 0, pho_tong_bien_tap: 1, truong_phong: 2 };
const LEADER_NAME_RANK = [[/^tổng biên tập$/i, 0], [/^phó tổng biên tập$/i, 1], [/^trưởng phòng$/i, 2]];
const DEPARTMENT_ORDER = ["phòng nội dung", "phòng truyền thông", "phòng tổng hợp"];
const leaderRank = (row) => LEADER_RANK[row.jobTitleCode ?? ""] ?? LEADER_NAME_RANK.find(([pattern]) => pattern.test((row.jobTitleName ?? "").trim()))?.[1] ?? 3;
const departmentRank = (row) => { const rank = DEPARTMENT_ORDER.indexOf((row.departmentName ?? "").trim().toLowerCase()); return rank === -1 ? DEPARTMENT_ORDER.length : rank; };
/** Stable sort: leaders first, then department order; ties keep the grid's existing order. */
export function sortAttendanceExportRows(rows) {
  return rows.map((row, position) => ({ row, position })).sort((a, b) => leaderRank(a.row) - leaderRank(b.row) || departmentRank(a.row) - departmentRank(b.row) || a.position - b.position).map(({ row }) => row);
}
export const DEFAULT_TAIL_STAFF = Object.freeze([
  { name: "Nguyễn Văn Linh", jobTitle: "Nhân viên", pattern: "weekdays" },
  { name: "Nguyễn Hồng Khánh", jobTitle: "Bảo vệ", pattern: "all_days" },
  { name: "Đặng Quang Minh", jobTitle: "Nhân viên", pattern: "unpaid" },
]);
export const DEFAULT_SIGNERS = Object.freeze({ generalAffairsHead: "Nguyễn Duy Đông", chiefAccountant: "Lê Thị Bích Thuận", editorInChief: "Lê Quang Thiện" });
export function buildAttendanceExportSheet(month, grid, monthlyRows = [], options = {}) {
  void monthlyRows;
  const days = daysInMonth(month); const width = 3 + days.length + 4; const lastColumn = columnNameFor(width); const businessDays = countBusinessDays(month); const rows = [];
  const blank = (value = "", style = "plain") => ({ value, style }); const empty = () => Array.from({ length: width }, () => blank());
  rows.push({ height: 18.75, cells: [blank("LIÊN HIỆP CÁC TỔ CHỨC", "heading"), ...Array.from({ length: width - 1 }, () => blank())] });
  rows.push({ height: 18.75, cells: [blank("HỮU NGHỊ VIỆT NAM", "heading"), ...Array.from({ length: width - 1 }, () => blank())] });
  rows.push({ height: 18.75, cells: empty() });
  rows.push({ height: 18.75, cells: [blank("TẠP CHÍ THỜI ĐẠI", "heading"), ...Array.from({ length: 16 }, () => blank()), blank(`Hà Nội, ngày ${days.length} tháng ${Number(month.slice(5, 7))} năm ${month.slice(0, 4)}`, "date"), ...Array.from({ length: width - 18 }, () => blank())] });
  rows.push({ height: 18.75, cells: empty() });
  rows.push({ height: 18.75, cells: [blank("BẢNG CHẤM CÔNG", "title"), ...Array.from({ length: width - 1 }, () => blank())] });
  rows.push({ height: 18.75, cells: [blank(`Tháng ${Number(month.slice(5, 7))}/${month.slice(0, 4)}`, "subtitle"), ...Array.from({ length: width - 1 }, () => blank())] });
  rows.push({ height: 18.75, cells: empty() });
  rows.push({ height: 18.75, cells: ["TT", "HỌ & TÊN", "CHỨC VỤ", ...days.map(exportDayHeader), "TỔNG", "P", "N", "CL"].map((value) => blank(value, "header")) });
  for (const [index, person] of sortAttendanceExportRows(grid.rows ?? []).entries()) {
    const byDate = new Map((person.cells ?? []).map((cell) => [cell.date, cell])); const monthCells = days.map((date) => byDate.get(date) ?? { date, code: "future", workday: 0 }); const total = monthCells.reduce((sum, cell) => sum + Number(cell.workday ?? 0), 0); const rowNumber = index + 10; const totalColumn = 3 + days.length + 1; const totalRef = `${columnNameFor(totalColumn)}${rowNumber}`; const pRef = `${columnNameFor(totalColumn + 1)}${rowNumber}`; const nRef = `${columnNameFor(totalColumn + 2)}${rowNumber}`;
    const values = [index + 1, person.name, person.jobTitleName ?? person.departmentName ?? "", ...monthCells.map(symbolForCell), total, "", "", ""];
    rows.push({ height: 20.1, cells: values.map((value, cellIndex) => ({ value, style: cellIndex >= 3 && cellIndex < 3 + days.length ? styleForCode() : cellIndex === 0 || cellIndex >= 3 + days.length ? "center" : "body", ...(cellIndex === totalColumn + 1 ? { formula: `${businessDays}-${totalRef}` } : {}), ...(cellIndex === totalColumn + 2 ? { formula: `${pRef}-${nRef}` } : {}) })) });
  }
  // Owner: three staff kept off the on-screen list always close the official sheet, filled like the template.
  if (options.includeDefaultStaff) {
    const firstNumber = (grid.rows ?? []).length + 1;
    const listedNames = new Set((grid.rows ?? []).map((row) => String(row.name ?? "").normalize("NFC").trim().toLowerCase()));
    DEFAULT_TAIL_STAFF.filter((person) => !listedNames.has(person.name.normalize("NFC").toLowerCase())).forEach((person, offset) => {
      const rowNumber = rows.length + 1; const totalColumn = 3 + days.length + 1;
      const isPast = (date) => !options.today || date <= options.today;
      const isWeekday = (date) => ![0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());
      const marks = days.map((date) => (!isPast(date) ? "" : person.pattern === "all_days" ? 1 : !isWeekday(date) ? "" : person.pattern === "unpaid" ? "Ro" : 1));
      const total = marks.reduce((sum, mark) => sum + (typeof mark === "number" ? mark : 0), 0);
      const totalRef = `${columnNameFor(totalColumn)}${rowNumber}`; const pRef = `${columnNameFor(totalColumn + 1)}${rowNumber}`; const nRef = `${columnNameFor(totalColumn + 2)}${rowNumber}`;
      const nCell = person.pattern === "unpaid" ? { value: 0 } : { value: "", formula: `${businessDays}-${totalRef}` };
      const clCell = person.pattern === "weekdays" ? { value: "", formula: `${pRef}-${nRef}` } : { value: 0 };
      const values = [firstNumber + offset, person.name, person.jobTitle, ...marks, total, ""];
      rows.push({ height: 20.1, cells: [...values.map((value, cellIndex) => ({ value, style: cellIndex >= 3 && cellIndex < 3 + days.length ? styleForCode() : cellIndex === 0 || cellIndex >= 3 + days.length ? "center" : "body" })), { ...nCell, style: "center" }, { ...clCell, style: "center" }] });
    });
  }
  const legendPairs = [["Nghỉ phép", "P"], ["Con ốm", "C.ô"], ["Ốm", "Ô"], ["Chế độ", "CĐ"], ["Ngừng việc", "N"], ["Nghỉ việc riêng", "R"], ["Nghỉ mát", "M"], ["Nghỉ không lương", "Ro"], ["Hội nghị, học tập", "H"], ["Đi công tác", "CT"], ["Nghỉ Tết", "NT"], ["Ngày lễ", "NL"], ["Đi sự kiện", "SK"], ["Làm việc online", "OL"], ["Quên thẻ", "QT"], ["Quên quẹt thẻ", "QQ"], ["Nghỉ phép nửa ngày", "½P"]];
  // Template layout: label/code column pairs B/C, D/J, N/T, X/AC; signatures span A:B, D:O, Q:Y, AD:last.
  const legendSlots = [[2, 3], [4, 10], [14, 20], [24, 29]];
  const footerMerges = [];
  rows.push({ height: 18.75, cells: empty() });
  for (let start = 0; start < legendPairs.length; start += legendSlots.length) {
    const cells = empty();
    legendPairs.slice(start, start + legendSlots.length).forEach(([label, code], slot) => { const [labelColumn, codeColumn] = legendSlots[slot]; cells[labelColumn - 1] = blank(`${label}:`, "legend"); cells[codeColumn - 1] = blank(code, "legendCode"); });
    rows.push({ height: 18.75, cells });
  }
  rows.push({ height: 18.75, cells: empty() });
  const signatureRow = rows.length + 1;
  const signatureCells = empty();
  for (const [from, to, title] of [[1, 2, "NGƯỜI LẬP BẢNG"], [4, 15, "TRƯỞNG PHÒNG TỔNG HỢP"], [17, 25, "KẾ TOÁN TRƯỞNG"], [30, width, "TỔNG BIÊN TẬP"]]) {
    signatureCells[from - 1] = blank(title, "signature");
    footerMerges.push(`${columnNameFor(from)}${signatureRow}:${columnNameFor(to)}${signatureRow}`);
  }
  rows.push({ height: 20.1, cells: signatureCells });
  for (let gap = 0; gap < 5; gap += 1) rows.push({ height: 18.75, cells: empty() });
  // Owner default signers (from the official template); "người lập bảng" is whoever exports the file.
  const signerRow = rows.length + 1;
  const signerCells = empty();
  for (const [from, to, name] of [[1, 2, options.preparedBy ?? ""], [4, 15, DEFAULT_SIGNERS.generalAffairsHead], [17, 25, DEFAULT_SIGNERS.chiefAccountant], [30, width, DEFAULT_SIGNERS.editorInChief]]) {
    signerCells[from - 1] = blank(name, "signature");
    footerMerges.push(`${columnNameFor(from)}${signerRow}:${columnNameFor(to)}${signerRow}`);
  }
  rows.push({ height: 20.1, cells: signerCells });
  return { name: String(Number(month.slice(5, 7))), columns: [{ width: 3.3 }, { width: 22.3 }, { width: 15.7 }, ...days.map(() => ({ width: 3.4 })), { width: 6.1 }, { width: 4.7 }, { width: 4.1 }, { width: 5 }], rows, styles: { plain: { font: { name: "Times New Roman", size: 12 } }, body: { font: { name: "Times New Roman", size: 12 }, border: true }, heading: { font: { name: "Times New Roman", size: 14, bold: true }, alignment: { horizontal: "center", vertical: "center" } }, title: { font: { name: "Times New Roman", size: 14, bold: true }, alignment: { horizontal: "center", vertical: "center" } }, subtitle: { font: { name: "Times New Roman", size: 14, bold: true, italic: true }, alignment: { horizontal: "center", vertical: "center" } }, date: { font: { name: "Times New Roman", size: 14, italic: true }, alignment: { horizontal: "right", vertical: "center" } }, header: { font: { name: "Times New Roman", size: 10, bold: true }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: true }, center: { font: { name: "Times New Roman", size: 12 }, alignment: { horizontal: "center", vertical: "center" }, border: true }, day: { font: { name: "Times New Roman", size: 11 }, alignment: { horizontal: "center", vertical: "center" }, border: true }, legend: { font: { name: "Times New Roman", size: 12 }, alignment: { horizontal: "left" } }, legendCode: { font: { name: "Times New Roman", size: 12 }, alignment: { horizontal: "left" } }, signature: { font: { name: "Times New Roman", size: 13, bold: true }, alignment: { horizontal: "center" } } }, merges: [`A1:C1`, `R1:${lastColumn}1`, `A2:C2`, `R2:${lastColumn}2`, `A4:C4`, `R4:${lastColumn}4`, `A6:${lastColumn}6`, `A7:${lastColumn}7`, ...footerMerges], pageSetup: { paperSize: 9, orientation: "landscape", fitToWidth: 1, fitToHeight: 0 } };
}
export function buildAttendanceExportXlsx(month, grid, monthlyRows = [], options = {}) { return writeXlsx(buildAttendanceExportSheet(month, grid, monthlyRows, options)); }
