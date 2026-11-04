import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { classifyTaskDeadline, deadlineLabel } from "./deadlinePresentation.mjs";

const now = new Date("2026-11-05T10:00:00+07:00");

test("classifies submitted and completed tasks by their submission timestamp", () => {
  assert.equal(classifyTaskDeadline({ status: "pending_review", due_date: "2026-11-05", due_time: "17:00", completion_submitted_at: "2026-11-05T09:00:00+07:00" }, now), "submitted_on_time");
  assert.equal(classifyTaskDeadline({ status: "done", due_date: "2026-11-05", due_time: "09:00", completed_at: "2026-11-05T10:00:01+07:00" }, now), "submitted_late");
});

test("active and rejected statuses ignore stale submissions and respect due time", () => {
  for (const status of ["new", "waiting", "in_progress", "blocked", "rejected"]) {
    const task = { status, due_date: "2026-11-05", due_time: "09:59:59", completion_submitted_at: "2026-11-03T12:00:00+07:00" };
    assert.equal(classifyTaskDeadline(task, now), "overdue");
    assert.equal(classifyTaskDeadline({ ...task, due_time: "10:00:00" }, now), "due_soon");
  }
});

test("submission wins over approval time and stays stable after the deadline", () => {
  for (const status of ["pending_review", "done"]) {
    const task = { status, due_date: "2026-11-05", due_time: "17:00", completion_submitted_at: "2026-11-03T12:00:00+07:00", completed_at: "2026-11-06T12:00:00+07:00" };
    assert.equal(classifyTaskDeadline(task, new Date("2026-11-10T00:00:00Z")), "submitted_on_time");
    assert.equal(classifyTaskDeadline({ ...task, completion_submitted_at: "2026-11-05T10:00:00Z" }, now), "submitted_on_time");
    assert.equal(classifyTaskDeadline({ ...task, completion_submitted_at: "2026-11-05T10:00:00.001Z" }, now), "submitted_late");
  }
});

test("date-only deadlines include the last millisecond of the Vietnam day", () => {
  const task = { status: "done", due_date: "2026-11-05", completion_submitted_at: "2026-11-05T16:59:59.999Z" };
  assert.equal(classifyTaskDeadline(task, now), "submitted_on_time");
  assert.equal(classifyTaskDeadline({ ...task, completion_submitted_at: "2026-11-05T17:00:00Z" }, now), "submitted_late");
  assert.equal(classifyTaskDeadline({ status: "new", due_date: "2026-11-05" }, new Date("2026-11-05T17:00:00Z")), "overdue");
});

test("missing or invalid submission times fall back without throwing", () => {
  for (const status of ["pending_review", "done"]) {
    for (const completion_submitted_at of [undefined, null, "", "invalid"]) {
      const task = { status, due_date: "2026-11-04", completion_submitted_at };
      assert.equal(classifyTaskDeadline(task, now), "overdue");
      assert.equal(classifyTaskDeadline({ ...task, completed_at: "2026-11-03T00:00:00Z" }, now), "submitted_on_time");
    }
    assert.equal(classifyTaskDeadline({ status, due_date: null }, now), "no_deadline");
  }
  assert.equal(classifyTaskDeadline({ status: "cancelled", due_date: null }, now), "cancelled");
});

test("due soon retains the inclusive three Vietnam calendar day boundary", () => {
  assert.equal(classifyTaskDeadline({ due_date: "2026-11-08" }, now), "due_soon");
  assert.equal(classifyTaskDeadline({ due_date: "2026-11-09" }, now), "on_time");
});

test("task detail and both project layouts use the shared helper with the full task", () => {
  const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
  const detail = read("../components/TaskDetailShell.tsx");
  const project = read("../components/ProjectDetailShell.tsx");
  const chip = read("../components/ProjectUi.tsx");
  const center = read("../components/TaskCenterShell.tsx");
  for (const source of [detail, chip, center]) {
    assert.match(source, /from "@\/lib\/deadlinePresentation\.mjs"/);
    assert.match(source, /classifyTaskDeadline\(task\)/);
    assert.doesNotMatch(source, /deadlineClassification\.mjs/);
  }
  assert.equal(project.match(/<DeadlineChip task=\{task\}/g)?.length, 2);
  assert.match(chip, /if \(label === null\) return null/);
  assert.match(read("./projectRepository.ts"), /due_date,due_time,completion_submitted_at,completed_at,priority/);
});

test("classifies unsubmitted tasks using the Vietnam due date and existing three-day window", () => {
  assert.equal(classifyTaskDeadline({ status: "in_progress", due_date: "2026-11-04" }, now), "overdue");
  assert.equal(classifyTaskDeadline({ status: "new", due_date: "2026-11-07" }, now), "due_soon");
  assert.equal(classifyTaskDeadline({ status: "waiting", due_date: "2026-11-10" }, now), "on_time");
});

test("handles missing due dates, cancelled tasks, and missing submission data", () => {
  assert.equal(classifyTaskDeadline({ status: "new", due_date: null }, now), "no_deadline");
  assert.equal(classifyTaskDeadline({ status: "cancelled", due_date: "2026-11-04" }, now), "cancelled");
  assert.equal(classifyTaskDeadline({ status: "pending_review", due_date: "2026-11-05", due_time: "17:00" }, now), "due_soon");
});

test("uses the approved Vietnamese presentation wording", () => {
  assert.equal(deadlineLabel("submitted_on_time"), "Nộp đúng hạn");
  assert.equal(deadlineLabel("submitted_late"), "Nộp trễ");
  assert.equal(deadlineLabel("on_time"), "Còn hạn");
  assert.equal(deadlineLabel("cancelled"), null);
});
