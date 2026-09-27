import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getAssignmentSourceDisplay } from "./taskAssignmentDisplay.mjs";

const legacy = { assignment_source: "legacy_unknown" };

test("preserves canonical assignment source labels", () => {
  assert.equal(getAssignmentSourceDisplay({ assignment_source: "leadership_assigned" }), "Lãnh đạo giao");
  assert.equal(getAssignmentSourceDisplay({ assignment_source: "self_registered" }), "Tự đăng ký");
});

test("labels proven legacy self-task as self-executed", () => {
  assert.equal(getAssignmentSourceDisplay({ ...legacy, created_by: "u1", owner_id: "u1", assignee_id: "u1" }), "Tự thực hiện");
});

test("keeps ambiguous legacy tasks unknown", () => {
  assert.equal(getAssignmentSourceDisplay({ ...legacy, created_by: "u1", owner_id: "u1", assignee_id: "u2" }), "Không xác định (dữ liệu cũ)");
  assert.equal(getAssignmentSourceDisplay({ ...legacy, created_by: "u1", owner_id: "u2", assignee_id: "u2" }), "Không xác định (dữ liệu cũ)");
  assert.equal(getAssignmentSourceDisplay(legacy), "Không xác định (dữ liệu cũ)");
  assert.equal(getAssignmentSourceDisplay({ ...legacy, created_by: "", owner_id: "", assignee_id: "" }), "Không xác định (dữ liệu cũ)");
});

test("does not infer from partial identity data", () => {
  assert.equal(getAssignmentSourceDisplay({ ...legacy, created_by: "u1", owner_id: "u1", assignee_id: null }), "Không xác định (dữ liệu cũ)");
  assert.equal(getAssignmentSourceDisplay({ ...legacy, created_by: " ", owner_id: " ", assignee_id: " " }), "Không xác định (dữ liệu cũ)");
});

test("summary table hides assignment source and preserves person columns", () => {
  const summary = readFileSync(new URL("../components/TaskCenterShell.tsx", import.meta.url), "utf8");
  assert.equal((summary.match(/getAssignmentSourceDisplay\(task\)/g) ?? []).length, 1);
  assert.doesNotMatch(summary, /<th[^>]*>Hình thức<\/th>/);
  assert.doesNotMatch(summary, /<dt[^>]*>Hình thức<\/dt>/);
  assert.match(summary, /colSpan=\{8\}/);
  assert.match(summary, /const semanticAssigner/);
  assert.match(summary, /const assigneeDisplay/);
});

test("detail and print reuse the same presentation helper", () => {
  const detail = readFileSync(new URL("../components/TaskDetailShell.tsx", import.meta.url), "utf8");
  const print = readFileSync(new URL("./taskPrintModel.ts", import.meta.url), "utf8");
  assert.match(detail, /getAssignmentSourceDisplay\(task\)/);
  assert.match(print, /getAssignmentSourceDisplay\(task\)/);
});

test("resolves the approved self-task approver as the displayed assigner", async () => {
  const { resolveDisplayedAssigner } = await import("./taskAssignmentDisplay.mjs");
  const result = resolveDisplayedAssigner({
    assignment_source: "legacy_unknown",
    created_by: "self",
    owner_id: "self",
    assignee_id: "self",
    assignment_approved_by: "approver",
    created_by_user: { full_name: "Phạm Thị Lý" },
    assignment_approver: { full_name: "Đinh Xuân Hòa" },
  });
  assert.deepEqual(result, { label: "Người giao việc", value: "Đinh Xuân Hòa" });
});

test("requires matching task identities before using an approval actor", async () => {
  const { resolveDisplayedAssigner } = await import("./taskAssignmentDisplay.mjs");
  const result = resolveDisplayedAssigner({
    assignment_source: "self_registered",
    created_by: "creator",
    owner_id: "owner",
    assignee_id: "assignee",
    created_by_user: { full_name: "Người tạo" },
    assignment_approver: { full_name: "Không được suy diễn" },
  });
  assert.equal(result.value, "Người tạo");
});

test("keeps self-task creator when approval is missing and preserves leadership assignment", async () => {
  const { resolveDisplayedAssigner } = await import("./taskAssignmentDisplay.mjs");
  assert.equal(resolveDisplayedAssigner({
    assignment_source: "legacy_unknown",
    created_by: "self",
    owner_id: "self",
    assignee_id: "self",
    created_by_user: { full_name: "Phạm Thị Lý" },
  }).value, "Phạm Thị Lý");
  assert.equal(resolveDisplayedAssigner({
    assignment_source: "leadership_assigned",
    created_by_user: { full_name: "Lãnh đạo" },
    assignment_approver: { full_name: "Không dùng" },
  }).value, "Lãnh đạo");
});

test("selects the latest assignment approval and ignores completion approval", async () => {
  const { selectAssignmentApprovalActor } = await import("./taskAssignmentDisplay.mjs");
  const selected = selectAssignmentApprovalActor([
    { from_status: "pending_review", to_status: "done", actor: { full_name: "Người chấm" }, created_at: "2026-09-30T10:00:00Z" },
    { from_status: "waiting", to_status: "in_progress", actor: { full_name: "Người duyệt cũ" }, created_at: "2026-09-29T10:00:00Z" },
    { from_status: "waiting", to_status: "in_progress", actor: { full_name: "Người duyệt mới" }, created_at: "2026-10-01T10:00:00Z" },
  ]);
  assert.equal(selected.actor.full_name, "Người duyệt mới");
});

test("shared resolver is used by summary, detail, and print", () => {
  const summary = readFileSync(new URL("../components/TaskCenterShell.tsx", import.meta.url), "utf8");
  const detail = readFileSync(new URL("../components/TaskDetailShell.tsx", import.meta.url), "utf8");
  const print = readFileSync(new URL("./taskPrintModel.ts", import.meta.url), "utf8");
  assert.match(summary, /resolveDisplayedAssigner/);
  assert.match(detail, /resolveDisplayedAssigner/);
  assert.match(print, /resolveDisplayedAssigner/);
});

test("display resolution does not mutate task identity or assignment source", async () => {
  const { resolveDisplayedAssigner } = await import("./taskAssignmentDisplay.mjs");
  const task = {
    assignment_source: "legacy_unknown",
    created_by: "self",
    owner_id: "self",
    assignee_id: "self",
    assignment_approved_by: "approver",
    created_by_user: { full_name: "Người tạo" },
    assignment_approver: { full_name: "Người duyệt" },
  };
  const before = JSON.stringify(task);
  resolveDisplayedAssigner(task);
  assert.equal(JSON.stringify(task), before);
});

test("repository resolves historical approvers in batched read-model queries", () => {
  const repository = readFileSync(new URL("./taskRepository.ts", import.meta.url), "utf8");
  assert.match(repository, /from\("task_status_events"\)[\s\S]*\.in\("task_id", candidates\.map/);
  assert.match(repository, /selectAssignmentApprovalActor/);
  assert.doesNotMatch(repository, /candidates\.map\(async/);
});
