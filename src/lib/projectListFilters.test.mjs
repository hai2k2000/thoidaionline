import assert from "node:assert/strict";
import test from "node:test";
import { filterAndSortProjects, normalizeProjectListFilters, DEFAULT_PROJECT_LIST_FILTERS } from "./projectListFilters.mjs";
import { readProjectFilterQuery, writeProjectFilterQuery, activeProjectFilterCount } from "./projectFilterQuery.mjs";

const rows = [
  { project: { id: "a", name: "Đà Nẵng", code: "B", status: "active", host_department_id: "d1", updated_at: "2026-01-01" }, myRole: "lead", leadPeople: [{ id: "u1", name: "An" }], taskCounts: { overdue: 1, in_progress: 2 } },
  { project: { id: "b", name: "An Giang", code: "A", status: "closed", host_department_id: "d2", updated_at: "2026-02-01" }, myRole: "deputy", leadPeople: [{ id: "u2", name: "Bình" }], taskCounts: { pending_review: 1, in_progress: 5 } },
  { project: { id: "c", name: "Cần Thơ", code: "C", status: "active", host_department_id: "d1", updated_at: "2026-03-01" }, myRole: "member", leadPeople: [], taskCounts: null },
  { project: { id: "d", name: "Huế", code: "D", status: "active", host_department_id: "d3", updated_at: "2026-04-01" }, myRole: null, leadPeople: [], taskCounts: {} },
];
const ids = (filters = {}, input = rows) => filterAndSortProjects(input, filters).map(row => row.project.id);
test("project filter URL round trip and reset preserve unrelated parameters", () => {
  const changed = { q: "Đà Nẵng", status: "active", role: "lead", dept: "d1", lead: "u1", tasks: "overdue", sort: "name_asc" };
  const query = writeProjectFilterQuery(new URLSearchParams("tab=library"), changed, DEFAULT_PROJECT_LIST_FILTERS);
  assert.deepEqual(readProjectFilterQuery(new URLSearchParams(query), DEFAULT_PROJECT_LIST_FILTERS), changed);
  assert.equal(activeProjectFilterCount(changed, DEFAULT_PROJECT_LIST_FILTERS), 6);
  assert.equal(writeProjectFilterQuery(new URLSearchParams(query), DEFAULT_PROJECT_LIST_FILTERS, DEFAULT_PROJECT_LIST_FILTERS), "tab=library");
});
test("project search folds Vietnamese accents in names and codes", () => {
  assert.deepEqual(ids({ q: " DA NANG " }), ["a"]);
  assert.deepEqual(ids({ q: "b" }), ["a"]);
});
test("project filters intersect and handle missing task counts", () => {
  for (const [role, expected] of [["lead", "a"], ["deputy", "b"], ["member", "c"], ["none", "d"]]) assert.deepEqual(ids({ role }), [expected]);
  assert.deepEqual(ids({ status: "closed" }), ["b"]);
  assert.deepEqual(ids({ dept: "d1" }), ["c", "a"]);
  assert.deepEqual(ids({ lead: "u1" }), ["a"]);
  assert.deepEqual(ids({ tasks: "overdue" }), ["a"]);
  assert.deepEqual(ids({ tasks: "pending_review" }), ["b"]);
  assert.deepEqual(ids({ status: "active", role: "lead", dept: "d1", lead: "u1", tasks: "overdue", q: "da nang" }), ["a"]);
  assert.deepEqual(ids({ lead: "unknown" }), []);
});
test("all project sort modes are immutable and default to updated descending", () => {
  assert.deepEqual(ids(), ["d", "c", "b", "a"]);
  assert.deepEqual(ids({ sort: "name_asc" }), ["b", "c", "a", "d"]);
  assert.deepEqual(ids({ sort: "code_asc" }), ["b", "a", "c", "d"]);
  assert.deepEqual(ids({ sort: "in_progress_desc" }), ["b", "a", "d", "c"]);
  assert.deepEqual(rows.map(row => row.project.id), ["a", "b", "c", "d"]);
  assert.deepEqual(ids({}, []), []);
  assert.deepEqual(normalizeProjectListFilters({}), DEFAULT_PROJECT_LIST_FILTERS);
});
