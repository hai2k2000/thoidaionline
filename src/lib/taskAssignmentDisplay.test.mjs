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
