import assert from "node:assert/strict";
import test from "node:test";
import { categoryCodeForLanguage, childCategories, resolveCategoryFilter, recordTypesForFilter, orderCategoriesForFilter, filterLanguageRecordTypes, getLanguageOption, hasSubcategories, isCompatibleLanguageSelection, resolveLanguageCategory, selectableCategories, sortRecordTypes } from "./languageGroup.mjs";

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

test("record types sort by explicit sort order before name and keep unsorted types last", () => {
  const types = [
    { id: "name-first", name: "A", sort_order: null },
    { id: "second", name: "Z", sort_order: 20 },
    { id: "first", name: "Y", sort_order: 10 },
    { id: "unsorted-b", name: "B", sort_order: null },
  ];
  assert.deepEqual(sortRecordTypes(types).map((type) => type.id), ["first", "second", "name-first", "unsorted-b"]);
});

test("language options expose stable codes and Vietnamese labels", () => {
  assert.deepEqual(getLanguageOption("vi"), { value: "vi", label: "Tiếng Việt" });
  assert.deepEqual(getLanguageOption("km"), { value: "km", label: "Tiếng Campuchia (Khmer)" });
  assert.deepEqual(getLanguageOption("ru"), { value: "ru", label: "Tiếng Nga" });
});

test("Russian uses the shared foreign-language record type family", () => {
  assert.equal(categoryCodeForLanguage("ru"), "noi_dung_tieng_nga");
  assert.equal(isCompatibleLanguageSelection("noi_dung_tieng_nga", "ngoai_ngu", "ru"), true);
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


test("subcategories require an explicit child selection and filter record types", () => {
  const nested = [...categories,
    { id: "letters", code: "tong_hop_van_thu_luu_tru", parent_id: "other", name: "Văn thư – Lưu trữ", sort_order: 10 },
    { id: "staff", code: "tong_hop_to_chuc_can_bo", parent_id: "other", name: "Tổ chức – Cán bộ", sort_order: 20 },
  ];
  const types = [{ id: "incoming", category_id: "letters", name: "Văn bản đến" }, { id: "contract", category_id: "staff", name: "Hợp đồng" }];
  assert.deepEqual(childCategories(nested, "other").map((item) => item.id), ["letters", "staff"]);
  assert.equal(hasSubcategories(nested, nested.find((item) => item.id === "other")), true);
  assert.deepEqual(filterLanguageRecordTypes(types, nested, "other", null, null), []);
  assert.deepEqual(filterLanguageRecordTypes(types, nested, "other", null, "letters"), [types[0]]);
});

test("groups without subcategories keep their existing record type behavior", () => {
  const types = [{ id: "plain", category_id: "other", name: "Báo cáo" }];
  assert.deepEqual(filterLanguageRecordTypes(types, categories, "other", null, null), types);
});

test("parent category requires a child before exposing child record types", () => {
  const nested = [
    { id: "parent", code: "doan_the_quan_ly", name: "Parent organizations", parent_id: null, sort_order: 50, restricted: false },
    { id: "public-child", code: "phap_ly_dieu_hanh", name: "Public child", parent_id: "parent", sort_order: 270, restricted: false },
    { id: "restricted-child", code: "cong_tac_dang", name: "Restricted child", parent_id: "parent", sort_order: 210, restricted: true },
  ];
  const types = [
    { id: "public-type", category_id: "public-child", name: "Regulation" },
    { id: "restricted-type", category_id: "restricted-child", name: "Party records" },
  ];
  const parent = nested.find((category) => category.id === "parent");
  assert.equal(hasSubcategories(nested, parent), true);
  assert.deepEqual(filterLanguageRecordTypes(types, nested, "parent", null, null), []);
  assert.deepEqual(filterLanguageRecordTypes(types, nested, "parent", null, "restricted-child"), [types[1]]);
});

test("orders filter categories by root then children without mutating the catalog", () => {
  const input = [
    { id: "root2", code: "root2", name: "Root 2", parent_id: null, sort_order: 20 },
    { id: "child3", code: "child3", name: "Child 3", parent_id: "root1", sort_order: 30 },
    { id: "root1", code: "root1", name: "Root 1", parent_id: null, sort_order: 10 },
    { id: "child1", code: "child1", name: "Child 1", parent_id: "root1", sort_order: 10 },
    { id: "child2", code: "child2", name: "Child 2", parent_id: "root1", sort_order: 20 },
  ];
  const original = structuredClone(input);
  assert.deepEqual(orderCategoriesForFilter(input).map((item) => item.id), ["root1", "child1", "child2", "child3", "root2"]);
  assert.deepEqual(input, original);
});

test("filter ordering breaks root and child ties by name and retains categories without a visible parent", () => {
  const input = [
    { id: "root-b", code: "root-b", name: "B", sort_order: 10 },
    { id: "child-b", code: "child-b", name: "B", parent_id: "root-a", sort_order: 10 },
    { id: "root-a", code: "root-a", name: "A", sort_order: 10 },
    { id: "child-a", code: "child-a", name: "A", parent_id: "root-a", sort_order: 10 },
    { id: "orphan", code: "orphan", name: "Orphan", parent_id: "missing", sort_order: 30 },
    { id: "legacy", code: "ngoai_ngu", name: "Legacy", sort_order: 0 },
  ];
  assert.deepEqual(orderCategoriesForFilter(input).map((item) => item.id), ["root-a", "child-a", "child-b", "root-b"]);
  assert.deepEqual(orderCategoriesForFilter([]), []);
});

const filterCategories = [...categories,
  { id: "letters", code: "letters", parent_id: "other", name: "Văn thư", sort_order: 2 },
  { id: "staff", code: "staff", parent_id: "other", name: "Cán bộ", sort_order: 1 },
  { id: "foreign", code: "ngoai_ngu", parent_id: null, name: "Ngoại ngữ" },
  { id: "plain", code: "plain", parent_id: null, name: "Không có con" },
];
const filterTypes = [
  { id: "letters-type", category_id: "letters", name: "Văn bản", sort_order: 2 },
  { id: "staff-type", category_id: "staff", name: "Cán bộ", sort_order: 1 },
  { id: "vi-type", category_id: "vi", name: "Tiếng Việt", sort_order: 3 },
  { id: "foreign-type", category_id: "foreign", name: "Ngoại ngữ", sort_order: 4 },
  { id: "plain-type", category_id: "plain", name: "Báo cáo", sort_order: 5 },
];
test("filter resolves a root to sorted children and aggregates their types", () => {
  assert.deepEqual(resolveCategoryFilter(filterCategories, "other", ""), { rootId: "other", subId: "", mode: "children", subOptions: [{ value: "staff", label: "Cán bộ" }, { value: "letters", label: "Văn thư" }] });
  assert.deepEqual(recordTypesForFilter(filterTypes, filterCategories, "other", "").map((item) => item.id), ["staff-type", "letters-type"]);
});
test("child URL restores its parent and narrows types to the selected child", () => {
  const resolved = resolveCategoryFilter(filterCategories, "letters", "");
  assert.equal(resolved.rootId, "other"); assert.equal(resolved.subId, "letters"); assert.equal(resolved.mode, "children");
  assert.deepEqual(recordTypesForFilter(filterTypes, filterCategories, "letters", "").map((item) => item.id), ["letters-type"]);
});
test("content filter uses language families including all languages without a selection", () => {
  assert.equal(resolveCategoryFilter(filterCategories, "root", "zh").mode, "language");
  assert.equal(resolveCategoryFilter(filterCategories, "root", "zh").subId, "zh");
  assert.deepEqual(recordTypesForFilter(filterTypes, filterCategories, "root", "zh").map((item) => item.id), ["foreign-type"]);
  assert.deepEqual(recordTypesForFilter(filterTypes, filterCategories, "root", "vi").map((item) => item.id), ["vi-type"]);
  assert.deepEqual(recordTypesForFilter(filterTypes, filterCategories, "root", "").map((item) => item.id), ["vi-type", "foreign-type"]);
});
test("leaf and unselected filters preserve their type scopes without mutating inputs", () => {
  assert.deepEqual(resolveCategoryFilter(filterCategories, "plain", ""), { rootId: "plain", subId: "", mode: "none", subOptions: [] });
  assert.deepEqual(recordTypesForFilter(filterTypes, filterCategories, "plain", "").map((item) => item.id), ["plain-type"]);
  const snapshot = JSON.stringify({ filterCategories, filterTypes });
  assert.deepEqual(recordTypesForFilter(filterTypes, filterCategories, "", "").map((item) => item.id), ["staff-type", "letters-type", "vi-type", "foreign-type", "plain-type"]);
  assert.equal(JSON.stringify({ filterCategories, filterTypes }), snapshot);
});
