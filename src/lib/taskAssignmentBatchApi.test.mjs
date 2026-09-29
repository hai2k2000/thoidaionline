import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const handler = () => read("./taskHandlerFactory.ts");
const repository = () => read("./taskRepository.ts");
const contracts = () => read("./taskContracts.ts");

test("batch assignment is selected only by the explicit batch mode", () => {
  const source = handler();
  assert.match(source, /body(?:\?\.)?mode\s*===\s*["']batch["']/);
  assert.match(source, /repository\.assignBatch\(/);
  assert.match(source, /repository\.assign\(/);
});

test("batch API contract includes shared recipient and bounded task cards", () => {
  const source = contracts();
  assert.match(source, /TaskAssignmentBatchInput/);
  assert.match(source, /batchId:\s*string/);
  assert.match(source, /departmentId:\s*string/);
  assert.match(source, /assigneeId:\s*string/);
  assert.match(source, /tasks:\s*TaskAssignmentBatchTask\[\]/);
  assert.match(source, /TaskAssignmentBatchResult/);
});

test("repository forwards the batch to the approved RPC without a second mutation path", () => {
  const source = repository();
  assert.match(source, /assignBatch[\s\S]*api_assign_task_batch_v1/);
  assert.match(source, /p_actor_id/);
  assert.match(source, /p_batch_id/);
  assert.match(source, /p_department_id/);
  assert.match(source, /p_assignee_id/);
  assert.match(source, /p_tasks/);
});

test("batch validation exposes card index and field details", () => {
  const source = handler();
  assert.match(source, /taskIndex/);
  assert.match(source, /field/);
  assert.match(source, /Việc/);
  assert.match(source, /1\s*\.\.\s*20|20/);
});

test("batch input does not add a notes field or reinterpret malformed single requests", () => {
  const source = handler();
  const batchType = contracts().match(/export type TaskAssignmentBatchTask[\s\S]*?export type TaskAssignmentBatchResult/);
  assert.ok(batchType, "batch contract types should be present");
  assert.doesNotMatch(batchType[0], /notes\??:\s*string/);
  assert.doesNotMatch(batchType[0], /evaluation_criteria.*notes|notes.*evaluation_criteria/i);
  assert.match(source, /mode\s*!==\s*["']batch["']|mode\s*===\s*["']batch["']/);
});
