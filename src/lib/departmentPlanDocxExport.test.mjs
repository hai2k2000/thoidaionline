import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { getDepartmentPlanPeriod } from "./departmentPlanPeriod.ts";
import { departmentPlanDocxFilename, exportDepartmentPlanDocx } from "./departmentPlanDocxExport.ts";

const item = (overrides = {}) => ({
  id: crypto.randomUUID(),
  department_plan_id: "10000000-0000-0000-0000-000000000001",
  department_id: "20000000-0000-0000-0000-000000000001",
  title: "Rà soát kế hoạch công tác tiếng Việt",
  description: "Tổng hợp tiến độ thực hiện",
  requirements: "Báo cáo đúng số liệu trong kỳ",
  due_at: "2026-10-09T10:00:00.000Z",
  assignee_id: "30000000-0000-0000-0000-000000000001",
  assignment_state: "assigned",
  work_status: "in_progress",
  linked_task_id: null,
  period_relation: "CARRY_OVER",
  period_start_state: "Đã tiếp nhận dữ liệu",
  period_end_state: "Đang hoàn thiện",
  result_this_period: "Đã hoàn thành bản tổng hợp lần một",
  carry_over_reason: "Chờ xác nhận số liệu cuối kỳ",
  progress_start: 20,
  progress_end: 80,
  completed_in_period: false,
  carry_forward: true,
  created_by: "40000000-0000-0000-0000-000000000001",
  created_at: "2026-10-03T00:00:00.000Z",
  updated_at: "2026-10-03T00:00:00.000Z",
  assignee_name: "Nguyễn Văn An",
  ...overrides,
});

const report = (period, items) => ({
  period,
  plan: {
    id: "10000000-0000-0000-0000-000000000001",
    department_id: "20000000-0000-0000-0000-000000000001",
    period_type: period.periodType,
    period_start: period.periodStart,
    period_end: period.periodEnd,
    created_by: "40000000-0000-0000-0000-000000000001",
    created_at: "2026-10-03T00:00:00.000Z",
    updated_at: "2026-10-03T00:00:00.000Z",
    status: "active",
  },
  employees: [],
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

test("Word export uses approved weekly and monthly filenames", () => {
  const weekly = getDepartmentPlanPeriod("weekly", "2026-10-05");
  const monthly = getDepartmentPlanPeriod("monthly", "2026-10-05");
  assert.equal(departmentPlanDocxFilename(weekly, "Phòng Tổng hợp"), "Bao_cao_cong_tac_tuan_Phong_Tong_hop_05-11_10_2026.docx");
  assert.equal(departmentPlanDocxFilename(monthly, "Phòng Tổng hợp"), "Bao_cao_cong_tac_thang_Phong_Tong_hop_10_2026.docx");
});

test("Word export creates an editable DOCX with the approved Vietnamese report structure", async () => {
  const period = getDepartmentPlanPeriod("weekly", "2026-10-05");
  const bytes = await exportDepartmentPlanDocx(report(period, [item()]), "Phòng Tổng hợp");
  assert.equal(Buffer.from(bytes).subarray(0, 2).toString("ascii"), "PK");
  const zip = await JSZip.loadAsync(bytes);
  for (const path of ["[Content_Types].xml", "word/document.xml", "word/styles.xml"]) assert.ok(zip.file(path), `${path} must exist`);
  const xml = await zip.file("word/document.xml").async("string");
  for (const value of ["I. Thông tin chung", "II. Kết quả công tác", "Nhiệm vụ / tên việc", "Nội dung / yêu cầu", "Thời hạn", "Quá trình triển khai", "Kết quả sản phẩm", "Tồn đọng, nguyên nhân và hướng xử lý", "III. Kế hoạch công tác kỳ tiếp theo", "IV. Kiến nghị/Đề xuất", "Rà soát kế hoạch công tác tiếng Việt", "Nguyễn Văn An"]) assert.match(xml, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const mojibake of ["Ã", "áº", "á»"]) assert.doesNotMatch(xml, new RegExp(mojibake));
});

test("recommendation section is omitted when selected period data has no recommendation", async () => {
  const period = getDepartmentPlanPeriod("monthly", "2026-10-01");
  const bytes = await exportDepartmentPlanDocx(report(period, [item({ work_status: "completed", carry_forward: false, carry_over_reason: null })]), "Phòng Tổng hợp");
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml").async("string");
  assert.doesNotMatch(xml, /IV\. Kiến nghị\/Đề xuất/);
});

test("report UI downloads Word only and preserves the current filters", () => {
  const source = readFileSync(new URL("../components/DepartmentPlanReport.tsx", import.meta.url), "utf8");
  assert.match(source, /exportDocx/);
  assert.match(source, /reports\/docx/);
  assert.match(source, /Xuất báo cáo Word/);
  for (const filter of ["employeeId", "status", "assignmentState"]) assert.match(source, new RegExp(`query\\.set\\("${filter}"`));
  assert.doesNotMatch(source, /exportPdf|reports\/pdf|Xuất PDF|\.pdf`/);
});

test("DOCX report route is GET-only and uses the approved filename helper", () => {
  const source = readFileSync(new URL("../app/api/planning/department/reports/docx/route.ts", import.meta.url), "utf8");
  assert.match(source, /export async function GET/);
  assert.match(source, /departmentPlanDocxFilename/);
  assert.match(source, /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/);
  assert.doesNotMatch(source, /POST|PATCH|DELETE|\.pdf/);
});
