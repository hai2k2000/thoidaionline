import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseTaskListSearchParams } from "./taskFilters.mjs";

const contracts = readFileSync(new URL("./taskContracts.ts", import.meta.url), "utf8");
const repository = readFileSync(new URL("./taskRepository.ts", import.meta.url), "utf8");
const handlers = readFileSync(new URL("./taskHandlerFactory.ts", import.meta.url), "utf8");

test("Journalism list filters parse only bounded values", () => {
  const workKindId = "11111111-1111-4111-8111-111111111111";
  const parsed = parseTaskListSearchParams(new URLSearchParams({
    journalism: "only",
    workKind: workKindId,
    publicationStatus: "scheduled",
    plannedFrom: "2026-10-01",
    plannedTo: "2026-10-31",
  }));
  assert.equal(parsed.journalism, "only");
  assert.equal(parsed.journalismWorkKindId, workKindId);
  assert.equal(parsed.publicationStatus, "scheduled");
  assert.equal(parsed.plannedPublicationFrom, "2026-10-01");
  assert.equal(parsed.plannedPublicationTo, "2026-10-31");

  const invalid = parseTaskListSearchParams(new URLSearchParams({
    journalism: "maybe",
    workKind: "not-a-uuid",
    publicationStatus: "drafting",
    plannedFrom: "2026-99-99",
  }));
  assert.equal(invalid.journalism, null);
  assert.equal(invalid.journalismWorkKindId, null);
  assert.equal(invalid.publicationStatus, null);
  assert.equal(invalid.plannedPublicationFrom, null);
});

test("Task DTOs expose nullable composed Journalism data", () => {
  assert.match(contracts, /export type JournalismWorkKindDto/);
  assert.match(contracts, /export type JournalismTaskListSummaryDto/);
  assert.match(contracts, /export type JournalismTaskDetailDto/);
  assert.match(contracts, /journalism:\s*JournalismTaskListSummaryDto \| null/);
  assert.match(contracts, /journalism:\s*JournalismTaskDetailDto \| null/);
});

test("Task repository composes Journalism data within authorized Task queries", () => {
  assert.match(repository, /journalism:journalism_task_details\(/);
  assert.match(repository, /work_kind:journalism_work_kinds\(/);
  assert.match(repository, /journalism_task_details\.work_kind_id/);
  assert.match(repository, /journalism_task_details\.publication_status/);
  assert.match(repository, /journalism_task_details\.planned_publication_at/);
  assert.match(repository, /\.range\(from, to\)/);
  assert.doesNotMatch(repository, /for \(const .* of .*data.*\)[\s\S]*from\(["']journalism_task_details/);
});

test("Journalism detail remains behind the existing parent Task guard", () => {
  assert.match(handlers, /const access = await taskGuard\(guard\.actor, taskId, "view"\)/);
  assert.match(handlers, /const result = await deps\.repository\.detail\(taskId\)/);
  assert.doesNotMatch(handlers, /journalism_task_details\/\:id|journalism_task_details.*route/i);
});
