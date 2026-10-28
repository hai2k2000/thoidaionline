import assert from "node:assert/strict";
import test from "node:test";
import { filterLanguageRecordTypes, getLanguageOption, isCompatibleLanguageSelection, resolveLanguageCategory, selectableCategories } from "./languageGroup.mjs";

const categories = [
  { id: "root", code: "phong_noi_dung", parent_id: null, name: "Phòng Nội dung" },
  { id: "vi", code: "noi_dung_tieng_viet", parent_id: "root", name: "Tổ Tiếng Việt" },
  { id: "en", code: "noi_dung_tieng_anh", parent_id: "root", name: "Tổ Tiếng Anh" },
  { id: "other", code: "tong_hop", parent_id: null, name: "Phòng Tổng hợp" },
];

test("selectable categories hide only the legacy foreign category", () => {
  const input = [...categories, { id: "legacy", code: "ngoai_ngu", parent_id: null, name: "legacy" }];
  assert.deepEqual(selectableCategories(input), categories);
});

test("language options expose stable codes and Vietnamese labels", () => {
  assert.deepEqual(getLanguageOption("vi"), { value: "vi", label: "Tiếng Việt" });
  assert.deepEqual(getLanguageOption("km"), { value: "km", label: "Tiếng Campuchia (Khmer)" });
});

test("language category resolution keeps non-content groups unchanged", () => {
  assert.equal(resolveLanguageCategory(categories, "root", "en")?.id, "en");
  assert.equal(resolveLanguageCategory(categories, "other", null)?.id, "other");
  assert.equal(resolveLanguageCategory(categories, "root", null), null);
});

test("content record types are shared across language child categories", () => {
  const types = [
    { id: "vi-type", category_id: "vi", code: "ho_so_de_tai" },
    { id: "foreign-type", category_id: "foreign", code: "ngoai_ngu_de_tai_tuyen_bai" },
    { id: "other", category_id: "other", code: "bao_cao" },
  ];
  const withLegacyForeign = [...categories, { id: "foreign", code: "ngoai_ngu", parent_id: null, name: "Các tổ Ngoại ngữ" }];
  assert.deepEqual(filterLanguageRecordTypes(types, withLegacyForeign, "root", "vi"), [types[0]]);
  assert.deepEqual(filterLanguageRecordTypes(types, withLegacyForeign, "root", "en"), [types[1]]);
  assert.deepEqual(filterLanguageRecordTypes(types, withLegacyForeign, "other", null), [types[2]]);
});

test("backend compatibility accepts only the matching content type family", () => {
  assert.equal(isCompatibleLanguageSelection("noi_dung_tieng_viet", "noi_dung_tieng_viet", "vi"), true);
  assert.equal(isCompatibleLanguageSelection("noi_dung_tieng_anh", "ngoai_ngu", "en"), true);
  assert.equal(isCompatibleLanguageSelection("noi_dung_tieng_anh", "noi_dung_tieng_viet", "en"), false);
  assert.equal(isCompatibleLanguageSelection("tong_hop", "tong_hop", null), true);
  assert.equal(isCompatibleLanguageSelection("tong_hop", "tong_hop", "en"), false);
});
