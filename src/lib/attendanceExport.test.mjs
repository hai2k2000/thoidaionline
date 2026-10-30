import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { buildAttendanceExportSheet, buildAttendanceExportXlsx, countBusinessDays } from "./attendanceExport.mjs";
function unzipLocalEntries(buffer) { const files = new Map(); let offset = 0; while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) { const size = buffer.readUInt32LE(offset + 18); const nameLength = buffer.readUInt16LE(offset + 26); const extraLength = buffer.readUInt16LE(offset + 28); const start = offset + 30; const data = start + nameLength + extraLength; const name = buffer.subarray(start, start + nameLength).toString(); files.set(name, inflateRawSync(buffer.subarray(data, data + size)).toString()); offset = data + size; } return files; }
const days = Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
const codes = new Map([["2026-10-01", ["present", 1]], ["2026-10-02", ["absent", 0]], ["2026-10-03", ["weekend", 0]], ["2026-10-05", ["business", 1]], ["2026-10-06", ["event", 1]], ["2026-10-07", ["online", 1]], ["2026-10-08", ["forgot_card", 1]], ["2026-10-09", ["forgot_swipe", 1]], ["2026-10-12", ["leave_full", 1]]]);
const grid = { days, rows: [{ staffId: "u1", name: "Nguyễn Văn A", departmentName: "Phòng Tổng hợp", jobTitleName: "Chuyên viên", cells: days.map((date) => ({ date, code: codes.get(date)?.[0] ?? "future", workday: codes.get(date)?.[1] ?? 0 })) }] };
test("October 2026 sheet matches the official attendance template model", () => { const sheet = buildAttendanceExportSheet("2026-10", grid); assert.equal(countBusinessDays("2026-10"), 22); assert.equal(sheet.name, "10"); assert.equal(sheet.rows[0].cells[0].value, "LIÊN HIỆP CÁC TỔ CHỨC"); assert.equal(sheet.rows[1].cells[0].value, "HỮU NGHỊ VIỆT NAM"); assert.equal(sheet.rows[3].cells[0].value, "TẠP CHÍ THỜI ĐẠI"); assert.equal(sheet.rows[3].cells[17].value, "Hà Nội, ngày 31 tháng 10 năm 2026"); assert.equal(sheet.rows[5].cells[0].value, "BẢNG CHẤM CÔNG"); assert.equal(sheet.rows[6].cells[0].value, "Tháng 10/2026"); assert.deepEqual(sheet.rows[8].cells.map((cell) => cell.value), ["TT", "HỌ & TÊN", "CHỨC VỤ", ...Array.from({ length: 31 }, (_, i) => i + 1), "TỔNG", "P", "N", "CL"]); const data = sheet.rows[9].cells; assert.equal(data[2].value, "Chuyên viên"); assert.deepEqual(data.slice(3, 15).map((cell) => cell.value), [1, "", "", "", "CT", "SK", "OL", "QT", "QQ", "", "", "P"]); assert.equal(data[34].value, 7); assert.equal(data[36].formula, "22-AI10"); assert.equal(data[37].formula, "AJ10-AK10"); const text = sheet.rows.flatMap((row) => row.cells.map((cell) => cell.value)).join("|"); for (const token of ["Đi sự kiện", "SK", "Làm việc online", "OL", "Quên thẻ", "QT", "Quên quẹt thẻ", "QQ", "NGƯỜI LẬP BẢNG", "TỔNG BIÊN TẬP"]) assert.match(text, new RegExp(token)); });
test("xlsx contains template merges, formulas, font, page setup, and month sheet name", () => { const files = unzipLocalEntries(buildAttendanceExportXlsx("2026-10", grid)); const sheet = files.get("xl/worksheets/sheet1.xml"); for (const merge of ["A1:C1", "R1:AL1", "A2:C2", "R2:AL2", "A4:C4", "R4:AL4", "A6:AL6", "A7:AL7"]) assert.match(sheet, new RegExp(`mergeCell ref="${merge}"`)); assert.match(sheet, /<f>22-AI10<\/f>/); assert.match(sheet, /orientation="landscape"/); assert.match(sheet, /paperSize="9"/); assert.match(sheet, /fitToWidth="1"/); assert.match(files.get("xl/styles.xml"), /Times New Roman/); assert.match(files.get("xl/workbook.xml"), /sheet name="10"/); });
test("attendance export builds a real xlsx buffer", () => { assert.ok(Buffer.isBuffer(buildAttendanceExportXlsx("2026-10", grid))); });


test("footer follows the template: legend in four pairs per row, signatures on one merged row", () => {
  const october = Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
  const sheet = buildAttendanceExportSheet("2026-10", { days: october, rows: [] }, []);
  const values = sheet.rows.map((row) => row.cells.map((cell) => cell.value));
  const signatureIndex = values.findIndex((row) => row.includes("NGƯỜI LẬP BẢNG"));
  const signatureRow = values[signatureIndex];
  for (const title of ["PHỤ TRÁCH PHÒNG TỔNG HỢP", "KẾ TOÁN TRƯỞNG", "TỔNG BIÊN TẬP"]) assert.ok(signatureRow.includes(title));
  assert.ok(sheet.merges.includes(`A${signatureIndex + 1}:B${signatureIndex + 1}`));
  assert.ok(sheet.merges.includes(`AD${signatureIndex + 1}:AL${signatureIndex + 1}`));
  const firstLegend = values.find((row) => row.includes("Nghỉ phép:"));
  assert.deepEqual([firstLegend[1], firstLegend[2], firstLegend[3], firstLegend[9]], ["Nghỉ phép:", "P", "Con ốm:", "C.ô"]);
  assert.ok(values.some((row) => row.includes("Quên quẹt thẻ:") && row.includes("QQ")));
  assert.equal(sheet.rows[2].cells[0].style, "plain");
});
