import assert from "node:assert/strict";
import test from "node:test";
import { classifyTaskDeadline } from "./deadlineClassification.mjs";

test("assigned completion is classified by completion timestamp in Vietnam timezone", () => {
  assert.equal(classifyTaskDeadline({ status: "pending_review", due_date: "2026-08-17", completion_submitted_at: "2026-08-17T16:59:59Z" }), "submitted_on_time");
  assert.equal(classifyTaskDeadline({ status: "pending_review", due_date: "2026-08-17", completion_submitted_at: "2026-08-17T17:00:00Z" }), "submitted_late");
});

test("active deadlines distinguish overdue, due soon and on time", () => {
  const now = new Date("2026-08-17T05:00:00Z");
  assert.equal(classifyTaskDeadline({ due_date: "2026-08-16", completion_submitted_at: null }, now), "overdue");
  assert.equal(classifyTaskDeadline({ due_date: "2026-08-20", completion_submitted_at: null }, now), "due_soon");
  assert.equal(classifyTaskDeadline({ due_date: "2026-08-21", completion_submitted_at: null }, now), "on_time");
});
