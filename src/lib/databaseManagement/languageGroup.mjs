export const CONTENT_ROOT_CODE = "phong_noi_dung";
export const LEGACY_FOREIGN_CATEGORY_CODE = "ngoai_ngu";

/**
 * @template {{ code: string }} T
 * @param {T[]} categories
 * @returns {T[]}
 */
export function selectableCategories(categories) {
  return categories.filter((category) => category.code !== LEGACY_FOREIGN_CATEGORY_CODE);
}

export function childCategories(categories, parentId) {
  return categories.filter((category) => category.parent_id === parentId).sort((left, right) => (left.sort_order ?? Number.POSITIVE_INFINITY) - (right.sort_order ?? Number.POSITIVE_INFINITY) || left.name.localeCompare(right.name));
}

export function hasSubcategories(categories, category) {
  return Boolean(category && category.code !== CONTENT_ROOT_CODE && childCategories(categories, category.id).length);
}

export function sortRecordTypes(recordTypes) {
  return [...recordTypes].sort((left, right) => {
    const leftOrder = left.sort_order ?? Number.POSITIVE_INFINITY;
    const rightOrder = right.sort_order ?? Number.POSITIVE_INFINITY;
    return leftOrder - rightOrder || left.name.localeCompare(right.name);
  });
}

export const LANGUAGE_OPTIONS = Object.freeze([
  { value: "vi", label: "Tiếng Việt", categoryCode: "noi_dung_tieng_viet", typeCategoryCode: "noi_dung_tieng_viet" },
  { value: "en", label: "Tiếng Anh", categoryCode: "noi_dung_tieng_anh", typeCategoryCode: LEGACY_FOREIGN_CATEGORY_CODE },
  { value: "zh", label: "Tiếng Trung", categoryCode: "noi_dung_tieng_trung", typeCategoryCode: LEGACY_FOREIGN_CATEGORY_CODE },
  { value: "lo", label: "Tiếng Lào", categoryCode: "noi_dung_tieng_lao", typeCategoryCode: LEGACY_FOREIGN_CATEGORY_CODE },
  { value: "km", label: "Tiếng Campuchia (Khmer)", categoryCode: "noi_dung_tieng_khmer", typeCategoryCode: LEGACY_FOREIGN_CATEGORY_CODE },
  { value: "ru", label: "Tiếng Nga", categoryCode: "noi_dung_tieng_nga", typeCategoryCode: LEGACY_FOREIGN_CATEGORY_CODE },
]);

export function getLanguageOption(code) {
  const option = LANGUAGE_OPTIONS.find((item) => item.value === code);
  return option ? { value: option.value, label: option.label } : null;
}

export function languageCodeForCategory(categoryCode) {
  return LANGUAGE_OPTIONS.find((item) => item.categoryCode === categoryCode)?.value ?? null;
}

export function isCompatibleLanguageSelection(categoryCode, typeCategoryCode, languageCode) {
  const option = LANGUAGE_OPTIONS.find((item) => item.categoryCode === categoryCode);
  if (!option) return languageCode === null && categoryCode === typeCategoryCode;
  return option.value === languageCode && option.typeCategoryCode === typeCategoryCode;
}

export function categoryCodeForLanguage(languageCode) {
  return LANGUAGE_OPTIONS.find((item) => item.value === languageCode)?.categoryCode ?? null;
}

export function resolveLanguageCategory(categories, selectedCategoryId, languageCode) {
  const selected = categories.find((category) => category.id === selectedCategoryId);
  if (!selected) return null;
  if (selected.code !== CONTENT_ROOT_CODE) return languageCode ? null : selected;
  const option = LANGUAGE_OPTIONS.find((item) => item.value === languageCode);
  return option ? categories.find((category) => category.parent_id === selected.id && category.code === option.categoryCode) ?? null : null;
}

export function filterLanguageRecordTypes(recordTypes, categories, selectedCategoryId, languageCode, subcategoryId) {
  const selected = categories.find((category) => category.id === selectedCategoryId);
  if (!selected) return [];
  if (selected.code !== CONTENT_ROOT_CODE) {
    const children = childCategories(categories, selected.id);
    if (children.length) return subcategoryId ? sortRecordTypes(recordTypes.filter((type) => type.category_id === subcategoryId)) : [];
    return sortRecordTypes(recordTypes.filter((type) => type.category_id === selected.id));
  }
  const option = LANGUAGE_OPTIONS.find((item) => item.value === languageCode);
  if (!option) return [];
  const typeCategory = categories.find((category) => category.code === option.typeCategoryCode);
  return typeCategory ? sortRecordTypes(recordTypes.filter((type) => type.category_id === typeCategory.id)) : [];
}

export function orderCategoriesForFilter(categories) {
  const visible = selectableCategories(categories);
  const roots = visible.filter((category) => !category.parent_id).sort((left, right) => (left.sort_order ?? Number.POSITIVE_INFINITY) - (right.sort_order ?? Number.POSITIVE_INFINITY) || left.name.localeCompare(right.name));
  return roots.flatMap((root) => [root, ...childCategories(visible, root.id)]);
}

export function resolveCategoryFilter(categories, categoryId, languageCode) {
  const visible = selectableCategories(categories);
  const selected = visible.find((category) => category.id === categoryId);
  if (!selected) return { rootId: "", subId: "", mode: "none", subOptions: [] };
  const root = selected.parent_id ? visible.find((category) => category.id === selected.parent_id) : selected;
  if (!root) return { rootId: selected.id, subId: "", mode: "none", subOptions: [] };
  if (root.code === CONTENT_ROOT_CODE) return { rootId: root.id, subId: selected.parent_id ? languageCodeForCategory(selected.code) ?? "" : languageCode ?? "", mode: "language", subOptions: LANGUAGE_OPTIONS.map((item) => ({ value: item.value, label: item.label })) };
  const subOptions = childCategories(visible, root.id).map((category) => ({ value: category.id, label: category.name }));
  return { rootId: root.id, subId: selected.parent_id ? selected.id : "", mode: subOptions.length ? "children" : "none", subOptions };
}

export function recordTypesForFilter(recordTypes, categories, categoryId, languageCode) {
  const resolved = resolveCategoryFilter(categories, categoryId, languageCode);
  if (!resolved.rootId) return [];
  if ((resolved.mode === "language" || resolved.mode === "children") && !resolved.subId) return [];
  if (resolved.mode === "language") {
    return filterLanguageRecordTypes(recordTypes, categories, resolved.rootId, resolved.subId);
  }
  if (resolved.mode === "children") {
    return sortRecordTypes(recordTypes.filter((type) => type.category_id === resolved.subId));
  }
  return sortRecordTypes(recordTypes.filter((type) => type.category_id === resolved.rootId));
}
