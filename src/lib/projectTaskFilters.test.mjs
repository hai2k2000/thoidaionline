import assert from "node:assert/strict";
import test from "node:test";
import { classifyTaskDeadline } from "./deadlineClassification.mjs";
import { DEFAULT_PROJECT_TASK_FILTERS, filterAndSortProjectTasks, normalizeProjectTaskFilters } from "./projectTaskFilters.mjs";

const now = new Date("2026-08-17T05:00:00Z");
const tasks = [
  { id: "cancelled", title: "Báo cáo hủy", status: "cancelled", assignee_id: "a", created_by: "u1", creator: { full_name: "Nguyễn An" }, due_date: "2026-08-20", created_at: "2026-08-01T00:00:00Z" },
  { id: "soon", title: "Công việc Có dấu", status: "in_progress", assignee_id: "a", created_by: "u1", creator: { full_name: "Nguyễn An" }, due_date: "2026-08-20", created_at: "2026-08-03T00:00:00Z" },
  { id: "overdue", title: "Bao cao khong dau", status: "in_progress", assignee_id: "b", created_by: "u2", creator: { full_name: "Tran Binh" }, due_date: "2026-08-16", created_at: "2026-08-05T00:00:00Z" },
  { id: "submitted", title: "Đã nộp", status: "done", assignee_id: "b", created_by: "u2", creator: { full_name: "Tran Binh" }, due_date: "2026-08-17", completion_submitted_at: "2026-08-17T16:59:59Z", created_at: "2026-08-04T00:00:00Z" },
  { id: "late", title: "Muộn", status: "pending_review", assignee_id: "a", created_by: "u1", creator: { full_name: "Nguyễn An" }, due_date: "2026-08-17", completion_submitted_at: "2026-08-17T17:00:00Z", created_at: "2026-08-02T00:00:00Z" },
  { id: "undated", title: "Không hạn", status: "new", assignee_id: null, created_by: "u3", creator: { full_name: "Lê Chi" }, due_date: null, created_at: "2026-08-06T00:00:00Z" },
  { id: "far", title: "Xa nhất", status: "new", assignee_id: null, created_by: "u3", creator: { full_name: "Lê Chi" }, due_date: "2026-08-30", created_at: "2026-08-07T00:00:00Z" },
];
const ids = result => result.tasks.map(task => task.id);

test("default filters hide cancelled and report hidden count", () => {
  const result = filterAndSortProjectTasks(tasks, {}, now);
  assert.deepEqual(ids(result), ["overdue", "submitted", "late", "soon", "far", "undated"]);
  assert.equal(result.hiddenCancelledCount, 1);
});

test("cancelled status shows only cancelled tasks", () => assert.deepEqual(ids(filterAndSortProjectTasks(tasks, { status: "cancelled" }, now)), ["cancelled"]));
test("search ignores case and Vietnamese diacritics", () => {
  assert.deepEqual(ids(filterAndSortProjectTasks(tasks, { search: "cong viec co dau" }, now)), ["soon"]);
  assert.deepEqual(ids(filterAndSortProjectTasks(tasks, { search: "BAO CAO KHONG DAU" }, now)), ["overdue"]);
});
test("filters by assignee and creator", () => assert.deepEqual(ids(filterAndSortProjectTasks(tasks, { assignee: "a", creator: "u1" }, now)), ["late", "soon"]));
test("each deadline state follows the shared classifier", () => {
  for (const state of ["overdue", "due_soon", "on_time", "no_deadline", "submitted_on_time", "submitted_late"]) {
    const expected = tasks.filter(task => classifyTaskDeadline(task, now) === state).map(task => task.id).sort();
    assert.deepEqual(ids(filterAndSortProjectTasks(tasks, { deadlineState: state }, now)).sort(), expected);
  }
});
test("date bounds are inclusive and exclude undated tasks", () => assert.deepEqual(ids(filterAndSortProjectTasks(tasks, { dateFrom: "2026-08-17", dateTo: "2026-08-20" }, now)), ["submitted", "late", "soon"]));
test("supports all sort orders", () => {
  assert.deepEqual(ids(filterAndSortProjectTasks(tasks, { sort: "due_desc" }, now)), ["far", "soon", "submitted", "late", "overdue", "undated"]);
  assert.deepEqual(ids(filterAndSortProjectTasks(tasks, { sort: "created_desc" }, now)), ["far", "undated", "overdue", "submitted", "soon", "late"]);
  assert.deepEqual(ids(filterAndSortProjectTasks(tasks, { sort: "title_asc" }, now)), ["overdue", "soon", "submitted", "undated", "late", "far"]);
});
test("normalizes partial reset input to defaults", () => assert.deepEqual(normalizeProjectTaskFilters({ search: "x" }), { ...DEFAULT_PROJECT_TASK_FILTERS, search: "x" }));

test("search handles stroked D, decomposed accents and accented queries", () => {
  for (const search of ["da nop", " ĐÃ NỘP ", "Đã nộp".normalize("NFD")]) {
    assert.deepEqual(ids(filterAndSortProjectTasks(tasks, { search }, now)), ["submitted"]);
  }
  assert.deepEqual(ids(filterAndSortProjectTasks(tasks, { search: "báo cáo không dấu" }, now)), ["overdue"]);
});
test("creator filtering works independently of assignee", () => {
  assert.deepEqual(ids(filterAndSortProjectTasks(tasks, { creator: "u2" }, now)), ["overdue", "submitted"]);
  assert.deepEqual(ids(filterAndSortProjectTasks(tasks, { assignee: "b" }, now)), ["overdue", "submitted"]);
});
test("one-sided date bounds exclude undated and preserve inclusive endpoints", () => {
  assert.deepEqual(ids(filterAndSortProjectTasks(tasks, { dateFrom: "2026-08-20" }, now)), ["soon", "far"]);
  assert.deepEqual(ids(filterAndSortProjectTasks(tasks, { dateTo: "2026-08-17" }, now)), ["overdue", "submitted", "late"]);
  assert.deepEqual(ids(filterAndSortProjectTasks(tasks, { dateFrom: "2026-08-20", dateTo: "2026-08-17" }, now)), []);
});
test("deadline filtering respects due time, submission status and completed_at fallback", () => {
  const timed = [
    { id: "elapsed", title: "A", status: "in_progress", due_date: "2026-08-17", due_time: "11:59:59", completion_submitted_at: "2026-08-16T00:00:00Z" },
    { id: "exact", title: "B", status: "pending_review", due_date: "2026-08-17", due_time: "12:00:00", completed_at: "2026-08-17T05:00:00Z" },
    { id: "late-time", title: "C", status: "done", due_date: "2026-08-17", due_time: "12:00:00", completed_at: "2026-08-17T05:00:01Z" },
  ];
  assert.deepEqual(ids(filterAndSortProjectTasks(timed, { deadlineState: "overdue" }, now)), ["elapsed"]);
  assert.deepEqual(ids(filterAndSortProjectTasks(timed, { deadlineState: "submitted_on_time" }, now)), ["exact"]);
  assert.deepEqual(ids(filterAndSortProjectTasks(timed, { deadlineState: "submitted_late" }, now)), ["late-time"]);
});
test("reset clears all selections and restores defaults", () => {
  const changed = { search: "hủy", status: "cancelled", assignee: "a", creator: "u1", deadlineState: "overdue", dateFrom: "2026-08-20", dateTo: "2026-08-20", sort: "title_asc" };
  assert.deepEqual(ids(filterAndSortProjectTasks(tasks, changed, now)), []);
  const reset = { ...DEFAULT_PROJECT_TASK_FILTERS };
  assert.deepEqual(ids(filterAndSortProjectTasks(tasks, reset, now)), ["overdue", "submitted", "late", "soon", "far", "undated"]);
  assert.equal(filterAndSortProjectTasks(tasks, reset, now).hiddenCancelledCount, 1);
});
test("hidden cancelled count describes default exclusion across the full list", () => {
  assert.equal(filterAndSortProjectTasks(tasks, { search: "missing" }, now).hiddenCancelledCount, 1);
  assert.equal(filterAndSortProjectTasks(tasks, { status: "cancelled" }, now).hiddenCancelledCount, 0);
  assert.equal(filterAndSortProjectTasks(tasks, { status: "done" }, now).hiddenCancelledCount, 0);
  assert.equal(filterAndSortProjectTasks([], {}, now).hiddenCancelledCount, 0);
});
test("sorting keeps input immutable", () => {
  const input = Object.freeze(tasks.map(task => Object.freeze({ ...task })));
  const before = input.map(task => task.id);
  for (const sort of ["due_asc", "due_desc", "created_desc", "title_asc"]) filterAndSortProjectTasks(input, { sort }, now);
  assert.deepEqual(input.map(task => task.id), before);
});
