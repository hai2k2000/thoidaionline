import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  deduplicateDepartmentPlanExcelRows,
  normalizeExcelHeader,
  parseDepartmentPlanExcelDate,
  parseDepartmentPlanExcelRows,
} from "./departmentPlanExcel.mjs";

const headers = ["STT", "Phòng ban", "Loại kỳ", "Từ ngày", "Đến ngày", "Tên công việc", "Nội dung / yêu cầu", "Người thực hiện", "Người phối hợp", "Ngày bắt đầu", "Mốc trong kỳ", "Hạn hoàn thành cuối", "Ngày báo cáo", "Mức ưu tiên", "Trạng thái", "Quan hệ với kỳ", "Nguồn công việc", "Task ID liên kết", "Yêu cầu xác nhận", "Ghi chú"];
const row = (index) => [index, "Phòng Nội dung", "Tuần", "28/09/2026", "04/10/2026", `Công việc ${index}`, "Nội dung", index === 1 ? "Ngô Tùng Dương; Nguyễn Hồng Khánh" : "Ngô Tùng Dương", "", "28/09/2026", "02/10/2026", new Date("2026-10-04T00:00:00Z"), "", "Ưu tiên 1", "Đang thực hiện", "Import", "Kế hoạch phòng", "", index === 1 ? "Có" : "", ""];

test("approved Excel headers are normalized by name instead of fixed positions", () => {
  assert.equal(normalizeExcelHeader("  Nội dung / yêu cầu "), "noi dung yeu cau");
  const reordered = [headers[5], headers[2], headers[3], headers[4], headers[7], headers[8], headers[11], headers[13], headers[14], headers[15], headers[16]];
  const values = ["Việc đổi cột", "Tuần", "28/09/2026", "04/10/2026", "Ngô Tùng Dương; Nguyễn Hồng Khánh", "", "04/10/2026", "Ưu tiên 2", "Kế hoạch", "Mới", "Lãnh đạo giao"];
  const parsed = parseDepartmentPlanExcelRows([reordered, values], { periodType: "weekly", periodStart: "2026-09-28", periodEnd: "2026-10-04" });
  assert.equal(parsed[0].title, "Việc đổi cột");
  assert.deepEqual(parsed[0].assigneeNames, ["Ngô Tùng Dương", "Nguyễn Hồng Khánh"]);
});

test("13 approved rows produce 13 preview candidates and preserve date cells", () => {
  const parsed = parseDepartmentPlanExcelRows([headers, ...Array.from({ length: 13 }, (_, index) => row(index + 1))], { periodType: "weekly", periodStart: "2026-09-28", periodEnd: "2026-10-04" });
  assert.equal(parsed.length, 13);
  assert.equal(parsed[0].dueDate, "2026-10-04");
  assert.equal(parsed[0].priority, "urgent");
  assert.equal(parsed[0].status, "in_progress");
  assert.equal(parsed[0].confirmationRequired, true);
});

test("Excel text and real date cells do not shift calendar dates", () => {
  assert.equal(parseDepartmentPlanExcelDate("03/10/2026"), "2026-10-03");
  assert.equal(parseDepartmentPlanExcelDate(new Date("2026-10-03T00:00:00Z")), "2026-10-03");
  assert.equal(parseDepartmentPlanExcelDate("31/02/2026"), null);
});

test("same linked task or title is deduplicated within the same period", () => {
  const base = { title: "Việc A", taskId: "11111111-1111-4111-8111-111111111111", periodType: "weekly", periodStart: "2026-09-28" };
  assert.equal(deduplicateDepartmentPlanExcelRows([base, { ...base }, { ...base, taskId: null, title: "Việc B" }, { ...base, taskId: null, title: " việc b " }]).length, 2);
});

test("invalid dates and unsupported enum values return friendly validation", () => {
  assert.throws(() => parseDepartmentPlanExcelRows([headers, [...row(1).slice(0, 11), "31/02/2026", ...row(1).slice(12)]], { periodType: "weekly", periodStart: "2026-09-28", periodEnd: "2026-10-04" }), /không hợp lệ/);
  assert.throws(() => parseDepartmentPlanExcelRows([headers, row(1).map((value, index) => index === 13 ? "Ưu tiên 9" : value)], { periodType: "weekly", periodStart: "2026-09-28", periodEnd: "2026-10-04" }), /Mức ưu tiên không hợp lệ/);
});

test("optional blank cells and empty trailing columns never crash", () => {
  const values = row(1).map((value, index) => ([8, 12, 17, 19].includes(index) ? undefined : value));
  assert.doesNotThrow(() => parseDepartmentPlanExcelRows([headers, values.concat([undefined, undefined])], { periodType: "weekly", periodStart: "2026-09-28", periodEnd: "2026-10-04" }));
  const parsed = parseDepartmentPlanExcelRows([headers, values], { periodType: "weekly", periodStart: "2026-09-28", periodEnd: "2026-10-04" });
  assert.deepEqual(parsed[0].collaboratorNames, []);
  assert.equal(parsed[0].reportDate, null);
  assert.equal(parsed[0].taskId, null);
  assert.equal(parsed[0].note, null);
});

test("missing required title returns a row-level Vietnamese validation error", () => {
  const values = row(1).map((value, index) => index === 5 ? "" : value);
  assert.throws(() => parseDepartmentPlanExcelRows([headers, values], { periodType: "weekly", periodStart: "2026-09-28", periodEnd: "2026-10-04" }), /Dòng 2: thiếu Tên công việc\./);
});

test("Department Plan Excel UI is preview-only and rejects DOCX", () => {
  const actions = readFileSync(new URL("../components/DepartmentPlanActions.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/planning/department/import/route.ts", import.meta.url), "utf8");
  assert.match(actions, /Import kế hoạch từ Excel/);
  assert.match(actions, /accept="\.xlsx"/);
  assert.doesNotMatch(actions, /accept="\.docx"/);
  assert.match(actions, /Xác nhận import/);
  assert.match(route, /persisted: false/);
  assert.match(route, /INVALID_IMPORT_FILE/);
  assert.match(route, /generic\.test/);
  assert.match(route, /item\.taskId/);
});

test("period report links back to the exact canonical weekly or monthly plan", () => {
  const report = readFileSync(new URL("../components/DepartmentPlanReport.tsx", import.meta.url), "utf8");
  assert.match(report, /← Quay lại kế hoạch kỳ/);
  assert.match(report, /departmentPlanUrl\(period\.periodType, period\.periodStart, departmentId\)/);
});
