import assert from "node:assert/strict";
import test from "node:test";
import {
  getVisibleRecordCount,
  hasActiveRecordFilters,
  presentLanguage,
  presentRecordType,
  presentStatus,
} from "./recordsListPresentation.mjs";

test("presents database list labels in Vietnamese while preserving unknown values", () => {
  assert.equal(presentLanguage("vi"), "Tiếng Việt");
  assert.equal(presentLanguage("legacy"), "legacy");
  assert.equal(presentLanguage(null), "Chưa xác định");
  assert.equal(presentStatus("pending_review"), "Chờ duyệt");
  assert.equal(presentStatus("future_status"), "future_status");
  assert.equal(presentRecordType({ name: "Hợp đồng", code: "contract" }), "Hợp đồng");
  assert.equal(presentRecordType({ name: null, code: "contract" }), "contract");
});

test("uses server-reported accessible total counts instead of page length", () => {
  assert.equal(getVisibleRecordCount([{ id: "1", total_count: 37 }]), 37);
  assert.equal(getVisibleRecordCount([{ id: "1" }, { id: "2" }]), 2);
  assert.equal(getVisibleRecordCount([]), 0);
});

test("detects active list filters for a clear action", () => {
  assert.equal(hasActiveRecordFilters({ query: "", languageCode: "", status: "" }), false);
  assert.equal(hasActiveRecordFilters({ query: "HS-2026", languageCode: "", status: "" }), true);
  assert.equal(hasActiveRecordFilters({ query: "", languageCode: "vi", status: "" }), true);
  assert.equal(hasActiveRecordFilters({ query: "", languageCode: "", status: "draft" }), true);
});
