import assert from "node:assert/strict";
import test from "node:test";
import { expandCategoryFilter, primaryCategoryForRecord } from "./categoryFilter.mjs";

const categories = [
  { id: "tong-hop", code: "tong_hop", parent_id: null, name: "Phòng Tổng hợp" },
  { id: "content", code: "phong_noi_dung", parent_id: null, name: "Phòng Nội dung" },
  { id: "vi", code: "noi_dung_tieng_viet", parent_id: "content", name: "Tổ Tiếng Việt" },
  { id: "en", code: "noi_dung_tieng_anh", parent_id: "content", name: "Tổ Tiếng Anh" },
  { id: "legacy", code: "ngoai_ngu", parent_id: null, name: "Các tổ Ngoại ngữ" },
];

test("expands a parent category before pagination while preserving direct legacy categories", () => {
  assert.deepEqual(expandCategoryFilter(categories, "content"), ["content", "vi", "en"]);
  assert.deepEqual(expandCategoryFilter(categories, "legacy"), ["legacy"]);
  assert.deepEqual(expandCategoryFilter(categories, null), null);
});

test("renders the top-level category for child language records", () => {
  assert.equal(primaryCategoryForRecord(categories, "vi")?.code, "phong_noi_dung");
  assert.equal(primaryCategoryForRecord(categories, "legacy")?.code, "ngoai_ngu");
});
