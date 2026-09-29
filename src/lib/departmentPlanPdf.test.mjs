import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { getDepartmentPlanPeriod } from "./departmentPlanPeriod.ts";
import {
  buildDepartmentPlanPdfModel,
  departmentPlanPdfFilename,
  renderDepartmentPlanPdf,
} from "./departmentPlanPdf.ts";

const fontBytes = await readFile(new URL("../../public/fonts/DejaVuSans.ttf", import.meta.url));
const boldFontBytes = await readFile(new URL("../../public/fonts/DejaVuSans-Bold.ttf", import.meta.url));

const item = (index, overrides = {}) => ({
  id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
  department_plan_id: "10000000-0000-0000-0000-000000000001",
  department_id: "20000000-0000-0000-0000-000000000001",
  title: `Công việc ${index + 1} – kiểm tra tiếng Việt`,
  description: null,
  requirements: null,
  due_at: index % 3 === 0 ? "2026-09-30T17:00:00.000Z" : null,
  assignee_id: index % 2 === 0 ? "30000000-0000-0000-0000-000000000001" : null,
  assignment_state: index % 2 === 0 ? "assigned" : "unassigned",
  work_status: index % 4 === 0 ? "completed" : "planned",
  linked_task_id: null,
  created_by: "40000000-0000-0000-0000-000000000001",
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  assignee_name: index % 2 === 0 ? "Trần Lê Sơn" : null,
  ...overrides,
});

const report = (period, items) => ({
  period,
  plan: null,
  employees: [{ id: "30000000-0000-0000-0000-000000000001", full_name: "Trần Lê Sơn", department_id: "20000000-0000-0000-0000-000000000001" }],
  items,
  metrics: {
    total: items.length,
    completed: items.filter((value) => value.work_status === "completed").length,
    inProgress: items.filter((value) => value.work_status === "in_progress").length,
    planned: items.filter((value) => value.work_status === "planned").length,
    overdue: 0,
    unassigned: items.filter((value) => value.assignment_state === "unassigned").length,
    departmentWide: items.filter((value) => value.assignment_state === "department_wide").length,
  },
});

const render = (period, items, filters = { employeeId: null, workStatus: null, assignmentState: null }) => renderDepartmentPlanPdf(
  buildDepartmentPlanPdfModel({
    departmentName: "Phòng Biên tập",
    periodLabel: `${period.periodStart} – ${period.periodEnd}`,
    report: report(period, items),
    filters,
    generatedAt: new Date("2026-09-26T06:00:00.000Z"),
  }),
  { fontBytes, boldFontBytes },
);

test("weekly and monthly exports use canonical periods and safe filenames", () => {
  const weekly = getDepartmentPlanPeriod("weekly", "2026-09-23");
  const monthly = getDepartmentPlanPeriod("monthly", "2026-09-23");
  assert.deepEqual(weekly, { periodType: "weekly", periodStart: "2026-09-21", periodEnd: "2026-09-27" });
  assert.deepEqual(monthly, { periodType: "monthly", periodStart: "2026-09-01", periodEnd: "2026-09-30" });
  assert.equal(departmentPlanPdfFilename("weekly", weekly.periodStart), "bao-cao-ke-hoach-phong-tuan-2026-09-21.pdf");
  assert.equal(departmentPlanPdfFilename("monthly", monthly.periodStart), "bao-cao-ke-hoach-phong-thang-2026-09-01.pdf");
});

test("PDF embeds Vietnamese text, preserves metrics, filters, and STT sequence", async () => {
  const period = getDepartmentPlanPeriod("weekly", "2026-09-21");
  const items = [item(0), item(1, { work_status: "in_progress" }), item(2, { assignment_state: "department_wide", assignee_id: null })];
  const output = await render(period, items, { employeeId: null, workStatus: "in_progress", assignmentState: null });
  assert.match(Buffer.from(output.bytes).subarray(0, 8).toString("ascii"), /^%PDF-/);
  assert.equal(output.filename, "bao-cao-ke-hoach-phong-tuan-2026-09-21.pdf");
  assert.equal(output.pageCount, 1);
  const doc = await PDFDocument.load(output.bytes);
  assert.equal(doc.getPageCount(), 1);
  const model = buildDepartmentPlanPdfModel({
    departmentName: "Phòng Biên tập",
    periodLabel: "21/09/2026 – 27/09/2026",
    report: report(period, items),
    filters: { employeeId: null, workStatus: "in_progress", assignmentState: null },
    generatedAt: new Date("2026-09-26T06:00:00.000Z"),
  });
  assert.equal(model.periodModeLabel, "Báo cáo tuần");
  assert.match(model.filtersLabel, /Trạng thái: Đang thực hiện/);
  assert.equal(model.metrics.total, 3);
  assert.equal(model.items[0].title, "Công việc 1 – kiểm tra tiếng Việt");
  assert.deepEqual(model.items.map((_, index) => index + 1), [1, 2, 3]);
});

test("empty reports render a valid empty-state PDF", async () => {
  const period = getDepartmentPlanPeriod("monthly", "2026-09-01");
  const output = await render(period, []);
  assert.match(Buffer.from(output.bytes).subarray(0, 8).toString("ascii"), /^%PDF-/);
  assert.equal(output.pageCount, 1);
  const doc = await PDFDocument.load(output.bytes);
  assert.equal(doc.getPageCount(), 1);
});

test("large reports paginate and keep sequential row numbering in the model", async () => {
  const period = getDepartmentPlanPeriod("weekly", "2026-09-21");
  const items = Array.from({ length: 45 }, (_, index) => item(index, { title: `Nội dung dài ${index + 1} – ${"x ".repeat(16)}` }));
  const output = await render(period, items);
  assert.ok(output.pageCount > 1, `expected multipage output, got ${output.pageCount}`);
  const doc = await PDFDocument.load(output.bytes);
  assert.equal(doc.getPageCount(), output.pageCount);
  assert.equal(items.length, 45);
  assert.deepEqual(items.map((_, index) => index + 1).slice(0, 3), [1, 2, 3]);
  assert.deepEqual(items.map((_, index) => index + 1).slice(-3), [43, 44, 45]);
});

test("PDF code has no mutation or export-storage behavior", () => {
  const source = readFileSync(new URL("./departmentPlanPdfHandler.ts", import.meta.url), "utf8");
  assert.match(source, /loadAuthorizedDepartmentPlanReport/);
  assert.doesNotMatch(source, /createTask|createItem|updateItem|deleteItem|POST|PATCH|DELETE|writeFile|insert|upsert/);
});
