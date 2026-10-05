import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");

test("admin bulk task UI exposes page-only selection and cancel actions", () => {
  const shell = read("../components/TaskCenterShell.tsx");
  assert.match(shell, /currentPageOnly|selectAll/);
  assert.match(shell, /Đã chọn/);
  assert.match(shell, /Huỷ công việc|Hủy công việc/);
  assert.match(shell, /Xoá công việc|Xóa công việc/);
  assert.match(shell, /currentUserRole === "admin"/);
});

test("bulk cancel endpoint is bounded and independently admin-authorized", () => {
  const route = read("../app/api/tasks/bulk-cancel/route.ts");
  assert.match(route, /role_code !== "admin"/);
  assert.match(route, /50/);
  assert.match(route, /cancelPersonal/);
  assert.match(route, /cancelAssigned/);
  assert.match(route, /results/);
});

test("bulk delete remains blocked when canonical single-delete contract is absent", () => {
  const source = read("../components/TaskCenterShell.tsx");
  assert.doesNotMatch(source, /fetch\("\/api\/tasks\/bulk-delete"/);
  assert.match(source, /ADMIN DELETE CONTRACT NOT FOUND/);
});

