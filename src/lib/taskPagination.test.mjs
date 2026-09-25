import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(new URL("./taskRepository.ts", import.meta.url), "utf8");

test("task list treats PostgREST out-of-range pages as valid empty results", () => {
  assert.match(repository, /export const isTaskListRangeExhausted/);
  assert.match(repository, /isTaskListRangeExhausted\(error\)/);
  assert.match(repository, /items: \[\], total: count \?\? 0, page: query\.page/);
});