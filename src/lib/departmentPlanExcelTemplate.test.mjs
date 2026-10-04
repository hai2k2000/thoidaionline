import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import readXlsxFile, { readSheetNames } from "read-excel-file/node";
import JSZip from "jszip";
import {
  createDepartmentPlanExcelTemplate,
  DEPARTMENT_PLAN_EXCEL_HEADERS,
  DEPARTMENT_PLAN_EXCEL_TEMPLATE_FILENAME,
} from "./departmentPlanExcelTemplate.mjs";
import { readDepartmentPlanExcel } from "./departmentPlanExcel.mjs";

const columnName = (index) => {
  let value = "";
  let current = index;
  while (current >= 0) {
    value = String.fromCharCode((current % 26) + 65) + value;
    current = Math.floor(current / 26) - 1;
  }
  return value;
};

test("template exposes approved headers, instruction sheet, formats, and validations", async () => {
  const bytes = await createDepartmentPlanExcelTemplate();
  assert.deepEqual(await readSheetNames(Buffer.from(bytes)), ["KeHoach_Import", "Huong Dan"]);
  const rows = await readXlsxFile(Buffer.from(bytes), { sheet: "KeHoach_Import" });
  assert.deepEqual(rows[0], DEPARTMENT_PLAN_EXCEL_HEADERS);
  assert.ok(rows.slice(1).every((row) => row.every((cell) => cell == null)), "template must not contain production data");
  assert.equal(DEPARTMENT_PLAN_EXCEL_TEMPLATE_FILENAME, "Mau_Import_Ke_Hoach_Phong.xlsx");
  const zip = await JSZip.loadAsync(bytes);
  const sheetXml = await zip.file("xl/worksheets/sheet1.xml").async("string");
  const styles = await zip.file("xl/styles.xml").async("string");
  assert.match(styles, /formatCode="dd\/mm\/yyyy"/);
  assert.match(sheetXml, /<dataValidations count="7">/);
  assert.match(sheetXml, /sqref="O2:O101"/);
  assert.match(sheetXml, /sqref="D2:E101 J2:M101"/);
  assert.match(sheetXml, /<sheetView tabSelected="1"/);
});

test("a filled template row parses through the production Excel importer", async () => {
  const bytes = await createDepartmentPlanExcelTemplate();
  const zip = await JSZip.loadAsync(bytes);
  const sheet = await zip.file("xl/worksheets/sheet1.xml").async("string");
  const rowCells = [
    "1", "Phòng Nội dung", "Tuần", "02/10/2026", "09/10/2026", "Công việc mẫu",
    "Nội dung mẫu", "Ngô Tùng Dương", "", "02/10/2026", "02/10/2026", "09/10/2026",
    "", "Ưu tiên 1", "Mới", "Import", "Import", "", "Có", "Ghi chú mẫu",
  ];
  const escape = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const dateColumns = new Set([3, 4, 9, 10, 11, 12]);
  const cells = rowCells.map((value, index) => `<c r="${columnName(index)}2" s="${dateColumns.has(index) ? 2 : 3}" t="inlineStr"><is><t>${escape(value)}</t></is></c>`).join("");
  const patched = sheet.replace(/<row r="2"[^>]*>.*?<\/row>/, `<row r="2" customFormat="1" customHeight="1" ht="22">${cells}</row>`);
  zip.file("xl/worksheets/sheet1.xml", patched);
  const filled = await zip.generateAsync({ type: "nodebuffer" });
  const parsed = await readDepartmentPlanExcel(new File([filled], DEPARTMENT_PLAN_EXCEL_TEMPLATE_FILENAME), {
    periodType: "weekly",
    periodStart: "2026-10-02",
    periodEnd: "2026-10-09",
  });
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title, "Công việc mẫu");
  assert.deepEqual(parsed[0].assigneeNames, ["Ngô Tùng Dương"]);
  assert.equal(parsed[0].dueDate, "2026-10-09");
  assert.equal(parsed[0].periodRelation, "IMPORTED");
});

test("empty inline string cells are accepted without dependency trim crashes", async () => {
  const bytes = await createDepartmentPlanExcelTemplate();
  const zip = await JSZip.loadAsync(bytes);
  const sheet = await zip.file("xl/worksheets/sheet1.xml").async("string");
  const cells = ["1", "Phòng Nội dung", "Tuần", "02/10/2026", "09/10/2026", "Công việc rỗng tùy chọn", "Nội dung", "Ngô Tùng Dương", "", "02/10/2026", "", "09/10/2026", "", "Ưu tiên 1", "Mới", "Import", "Import", "", "", ""];
  const escape = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const row = cells.map((value, index) => value === "" ? `<c r="${columnName(index)}2" t="str"></c>` : `<c r="${columnName(index)}2" t="inlineStr"><is><t>${escape(value)}</t></is></c>`).join("");
  zip.file("xl/worksheets/sheet1.xml", sheet.replace(/<row r="2"[^>]*>.*?<\/row>/, `<row r="2">${row}</row>`));
  const filled = await zip.generateAsync({ type: "nodebuffer" });
  await assert.rejects(() => readXlsxFile(filled, { sheet: "KeHoach_Import" }), /reading 'trim'/);
  const parsed = await readDepartmentPlanExcel(new File([filled], DEPARTMENT_PLAN_EXCEL_TEMPLATE_FILENAME), { periodType: "weekly", periodStart: "2026-10-02", periodEnd: "2026-10-09" });
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].note, null);
  assert.deepEqual(parsed[0].collaboratorNames, []);
});

test("template download action is adjacent to the Excel import action", async () => {
  const actions = await readFile(new URL("../components/DepartmentPlanActions.tsx", import.meta.url), "utf8");
  const importIndex = actions.indexOf("Import kế hoạch từ Excel");
  const downloadIndex = actions.indexOf("Tải file Excel mẫu");
  assert.ok(importIndex >= 0 && downloadIndex > importIndex);
  assert.match(actions, /href="\/api\/planning\/department\/template"/);
  assert.match(actions, /download="Mau_Import_Ke_Hoach_Phong\.xlsx"/);
});
