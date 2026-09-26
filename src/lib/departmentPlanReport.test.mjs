import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  calculateDepartmentPlanReportMetrics,
  filterDepartmentPlanReportItems,
  isDepartmentPlanItemOverdue,
  isReportAssignmentState,
  isReportWorkStatus,
  localDateInTimeZone,
} from "./departmentPlanReport.ts";

const item = (overrides = {}) => ({
  id: crypto.randomUUID(),
  department_plan_id: "plan",
  department_id: "department",
  title: "Công việc",
  description: null,
  requirements: null,
  due_at: null,
  assignee_id: null,
  assignment_state: "unassigned",
  work_status: "planned",
  linked_task_id: null,
  created_by: "creator",
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  ...overrides,
});

test("canonical report statuses and assignment states are the approved values", () => {
  for (const value of ["planned", "in_progress", "completed", "cancelled"]) assert.equal(isReportWorkStatus(value), true);
  for (const value of ["unassigned", "department_wide", "assigned"]) assert.equal(isReportAssignmentState(value), true);
  assert.equal(isReportWorkStatus("done"), false);
  assert.equal(isReportAssignmentState("all"), false);
});

test("metrics count total, completed, in progress, and planned", () => {
  const metrics = calculateDepartmentPlanReportMetrics([
    item({ work_status: "completed" }),
    item({ work_status: "in_progress" }),
    item({ work_status: "planned" }),
    item({ work_status: "cancelled" }),
  ], new Date("2026-09-30T05:00:00Z"));
  assert.deepEqual(metrics, {
    total: 4, completed: 1, inProgress: 1, planned: 1,
    overdue: 0, unassigned: 4, departmentWide: 0,
  });
});

test("unassigned and department-wide metrics remain separate", () => {
  const metrics = calculateDepartmentPlanReportMetrics([
    item({ assignment_state: "unassigned" }),
    item({ assignment_state: "department_wide" }),
    item({ assignment_state: "assigned", assignee_id: "employee" }),
  ]);
  assert.equal(metrics.unassigned, 1);
  assert.equal(metrics.departmentWide, 1);
});

test("assigned items are not counted as unassigned or department-wide", () => {
  const metrics = calculateDepartmentPlanReportMetrics([
    item({ assignment_state: "assigned", assignee_id: "employee" }),
  ]);
  assert.equal(metrics.unassigned, 0);
  assert.equal(metrics.departmentWide, 0);
});

test("overdue uses Vietnam local date and excludes the current day", () => {
  const now = new Date("2026-09-30T01:00:00Z");
  assert.equal(isDepartmentPlanItemOverdue(item({ due_at: "2026-09-28T17:00:00Z" }), now), true);
  assert.equal(isDepartmentPlanItemOverdue(item({ due_at: "2026-09-29T17:00:00Z" }), now), false);
  assert.equal(localDateInTimeZone(now), "2026-09-30");
});

test("completed items are never overdue", () => {
  assert.equal(isDepartmentPlanItemOverdue(item({ due_at: "2026-09-01T00:00:00Z", work_status: "completed" }), new Date("2026-09-30T00:00:00Z")), false);
});

test("cancelled items are treated as final for overdue", () => {
  assert.equal(isDepartmentPlanItemOverdue(item({ due_at: "2026-09-01T00:00:00Z", work_status: "cancelled" }), new Date("2026-09-30T00:00:00Z")), false);
});

test("items without due dates are never overdue", () => {
  assert.equal(isDepartmentPlanItemOverdue(item({ due_at: null }), new Date("2026-09-30T00:00:00Z")), false);
});

test("employee filter selects only the authorized assignee", () => {
  const result = filterDepartmentPlanReportItems([
    item({ assignee_id: "employee-a", assignment_state: "assigned" }),
    item({ assignee_id: "employee-b", assignment_state: "assigned" }),
  ], { employeeId: "employee-a", workStatus: null, assignmentState: null });
  assert.equal(result.length, 1);
  assert.equal(result[0].assignee_id, "employee-a");
});

test("work status filter selects only canonical status", () => {
  const result = filterDepartmentPlanReportItems([
    item({ work_status: "planned" }),
    item({ work_status: "in_progress" }),
  ], { employeeId: null, workStatus: "in_progress", assignmentState: null });
  assert.equal(result.length, 1);
  assert.equal(result[0].work_status, "in_progress");
});

test("assignment state filter selects only the requested state", () => {
  const result = filterDepartmentPlanReportItems([
    item({ assignment_state: "unassigned" }),
    item({ assignment_state: "department_wide" }),
  ], { employeeId: null, workStatus: null, assignmentState: "department_wide" });
  assert.equal(result.length, 1);
  assert.equal(result[0].assignment_state, "department_wide");
});

test("combined filters narrow the same dataset used for metrics", () => {
  const filtered = filterDepartmentPlanReportItems([
    item({ assignee_id: "employee-a", assignment_state: "assigned", work_status: "completed" }),
    item({ assignee_id: "employee-a", assignment_state: "assigned", work_status: "planned" }),
    item({ assignee_id: "employee-b", assignment_state: "assigned", work_status: "completed" }),
  ], { employeeId: "employee-a", workStatus: "completed", assignmentState: "assigned" });
  assert.equal(calculateDepartmentPlanReportMetrics(filtered).total, 1);
  assert.equal(calculateDepartmentPlanReportMetrics(filtered).completed, 1);
});

test("empty filtered result returns zero metrics", () => {
  const filtered = filterDepartmentPlanReportItems([item()], {
    employeeId: "missing",
    workStatus: null,
    assignmentState: null,
  });
  assert.equal(filtered.length, 0);
  assert.equal(calculateDepartmentPlanReportMetrics(filtered).total, 0);
});

test("report repository is read-only and never calls plan creation", () => {
  const source = readFileSync(new URL("./departmentPlanReportRepository.ts", import.meta.url), "utf8");
  assert.match(source, /getPeriod/);
  assert.match(source, /listPlanItems/);
  assert.doesNotMatch(source, /getOrCreatePlanForMutation/);
  assert.doesNotMatch(source, /createItem|updateItem|deleteItem/);
});

test("report API is GET-only", () => {
  const source = readFileSync(new URL("../app/api/planning/department/reports/route.ts", import.meta.url), "utf8");
  assert.match(source, /export const GET/);
  assert.doesNotMatch(source, /POST|PATCH|DELETE/);
});

test("report handler authorizes server-side scope and filters employee scope", () => {
  const source = readFileSync(new URL("./departmentPlanReportService.ts", import.meta.url), "utf8");
  assert.match(source, /requireReadActor/);
  assert.match(source, /resolveDepartmentPlanScope\(asActor\(guard\.actor\), departmentId\)/);
  assert.match(source, /employeeId/);
  assert.match(source, /departmentPlanReportRepository\.getReport/);
});

test("report page reuses canonical period navigation", () => {
  const source = readFileSync(new URL("../app/planning/reports/page.tsx", import.meta.url), "utf8");
  assert.match(source, /canonicalPeriodFromQuery/);
  assert.match(source, /departmentPlanReportUrl/);
  assert.doesNotMatch(source, /getOrCreatePlanForMutation|method: "POST"/);
});

test("report UI renders all required metrics and filters", () => {
  const source = readFileSync(new URL("../components/DepartmentPlanReport.tsx", import.meta.url), "utf8");
  for (const label of ["Tổng công việc", "Hoàn thành", "Đang thực hiện", "Kế hoạch", "Quá hạn", "Chưa phân công", "Cả phòng"]) {
    assert.match(source, new RegExp(label));
  }
  for (const label of ["Nhân viên", "Trạng thái", "Phân công"]) assert.match(source, new RegExp(label));
});

test("report UI has no mutation controls or plan-to-task calls", () => {
  const source = readFileSync(new URL("../components/DepartmentPlanReport.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /method: "POST"|method: "PATCH"|method: "DELETE"|createTask|api\/tasks/);
});

test("report navigation preserves department and selected period", () => {
  const source = readFileSync(new URL("./departmentPlanNavigation.ts", import.meta.url), "utf8");
  assert.match(source, /departmentPlanReportUrl/);
  assert.match(source, /period: periodType/);
  assert.match(source, /start: periodStart/);
  assert.match(source, /departmentId/);
});

test("department plan shell links to the report without changing period", () => {
  const source = readFileSync(new URL("../components/DepartmentPlanShell.tsx", import.meta.url), "utf8");
  assert.match(source, /departmentPlanReportUrl\(period\.periodType, period\.periodStart/);
});

