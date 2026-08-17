import assert from "node:assert/strict";
import test from "node:test";

import { parseTaskListSearchParams, taskListHref } from "./taskFilters.mjs";

test("Task Center filters round-trip through canonical URL state", () => {
  const params = new URLSearchParams({
    q: "  Báo cáo  ",
    scope: "personal",
    type: "personal",
    status: "blocked",
    from: "2026-08-01",
    to: "2026-08-31",
    deadline: "overdue",
    department: "11111111-1111-4111-8111-111111111111",
    page: "3",
  });
  const parsed = parseTaskListSearchParams(params);
  assert.deepEqual(parsed, {
    search: "Báo cáo",
    scope: "personal",
    taskType: "personal",
    status: "blocked",
    fromDate: "2026-08-01",
    toDate: "2026-08-31",
    deadlineState: "overdue",
    departmentId: "11111111-1111-4111-8111-111111111111",
    page: 3,
    pageSize: 25,
  });
  assert.equal(
    taskListHref(parsed, { page: 4 }),
    "/tasks?q=B%C3%A1o+c%C3%A1o&scope=personal&type=personal&status=blocked&from=2026-08-01&to=2026-08-31&deadline=overdue&department=11111111-1111-4111-8111-111111111111&page=4",
  );
});

test("invalid filters fall back safely without widening page size", () => {
  const parsed = parseTaskListSearchParams(new URLSearchParams({
    scope: "someone-else",
    type: "legacy",
    status: "deleted",
    from: "2026-99-99",
    deadline: "late-ish",
    department: "not-a-uuid",
    page: "-2",
    pageSize: "999",
  }));
  assert.deepEqual(parsed, {
    search: null,
    scope: "all",
    taskType: null,
    status: null,
    fromDate: null,
    toDate: null,
    deadlineState: null,
    departmentId: null,
    page: 1,
    pageSize: 25,
  });
});