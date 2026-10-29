import assert from "node:assert/strict";
import test from "node:test";
import { parseRecordListParams, serializeRecordListState, parseRecordListState } from "./recordsListFilters.mjs";

test("record list state round-trips through URL query", () => {
  const state = { q: "abc", categoryId: "11111111-1111-4111-8111-111111111111", recordTypeId: "22222222-2222-4222-8222-222222222222", languageCode: "en", status: "draft", page: 2, pageSize: 50, sort: "title", sortDir: "asc", createdFrom: "2026-01-01", hasFiles: true };
  assert.deepEqual(parseRecordListState(new URLSearchParams(serializeRecordListState(state))), { ...state, createdTo: "", updatedFrom: "", updatedTo: "", departmentId: "", ownerId: "", createdBy: "", keyword: "" });
});

test("API params reject invalid UUID/date/boolean/sort", () => {
  assert.throws(() => parseRecordListParams(new URLSearchParams("departmentId=bad")), /invalid_filter/);
  assert.throws(() => parseRecordListParams(new URLSearchParams("createdFrom=2026-99-99")), /invalid_filter/);
  assert.throws(() => parseRecordListParams(new URLSearchParams("hasFiles=maybe")), /invalid_filter/);
  assert.throws(() => parseRecordListParams(new URLSearchParams("sort=drop")), /invalid_filter/);
});

test("valid API params normalize pagination and booleans", () => {
  const result = parseRecordListParams(new URLSearchParams("limit=50&offset=100&hasFiles=1&sort=title&sortDir=asc"));
  assert.equal(result.limit, 50);
  assert.equal(result.offset, 100);
  assert.equal(result.hasFiles, true);
  assert.equal(result.sort, "title");
});

test("visibility filter accepts only department or public and serializes", () => {
  const state = { visibility: "public", page: 1, pageSize: 20, sort: "updated_at", sortDir: "desc" };
  assert.equal(parseRecordListState(new URLSearchParams(serializeRecordListState(state))).visibility, "public");
  assert.throws(() => parseRecordListParams(new URLSearchParams("visibility=private")), /invalid_filter/);
});
