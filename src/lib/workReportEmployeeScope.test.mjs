import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isWorkReportEmployeeVisible } from "./workReport.ts";

const repository = readFileSync("src/lib/workReportRepository.ts", "utf8");
const service = readFileSync("src/lib/workReportService.ts", "utf8");

test("work report repository uses canonical admin classification and excludes admin rows server-side", () => {
  assert.match(repository, /roles\(code\)/);
  assert.match(repository, /isWorkReportEmployeeVisible/);
  assert.match(repository, /employeeIds\.includes\(id\)/);
});

test("admin/system accounts are excluded by canonical role or username, not display name", () => {
  assert.equal(isWorkReportEmployeeVisible({ id: "admin-role", full_name: "Tài khoản hệ thống", department_id: "dep", roles: { code: "admin" } }), false);
  assert.equal(isWorkReportEmployeeVisible({ id: "admin-user", full_name: "Người dùng", department_id: "dep", username: "admin", roles: { code: "employee" } }), false);
  assert.equal(isWorkReportEmployeeVisible({ id: "display-admin", full_name: "Admin", department_id: "dep", username: "a.nguyen", roles: { code: "employee" } }), true);
});

test("department manager self exclusion is scoped to their own report department", () => {
  assert.match(service, /actor\.role_code === "truong_phong"/);
  assert.match(service, /actor\.is_department_manager === true/);
  assert.match(service, /actor\.department_id === scope/);
  assert.match(service, /excludeEmployeeId/);
});

test("report scope does not add client-only filtering or mutate task semantics", () => {
  assert.doesNotMatch(repository, /delete\s+task|update\(|insert\(|rpc\(/);
  assert.match(repository, /sourceForTask\(task\)/);
  assert.match(repository, /filters\.status/);
});
