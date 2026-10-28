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

export const LANGUAGE_OPTIONS = Object.freeze([
  { value: "vi", label: "Tiếng Việt", categoryCode: "noi_dung_tieng_viet", typeCategoryCode: "noi_dung_tieng_viet" },
  { value: "en", label: "Tiếng Anh", categoryCode: "noi_dung_tieng_anh", typeCategoryCode: LEGACY_FOREIGN_CATEGORY_CODE },
  { value: "zh", label: "Tiếng Trung", categoryCode: "noi_dung_tieng_trung", typeCategoryCode: LEGACY_FOREIGN_CATEGORY_CODE },
  { value: "lo", label: "Tiếng Lào", categoryCode: "noi_dung_tieng_lao", typeCategoryCode: LEGACY_FOREIGN_CATEGORY_CODE },
  { value: "km", label: "Tiếng Campuchia (Khmer)", categoryCode: "noi_dung_tieng_khmer", typeCategoryCode: LEGACY_FOREIGN_CATEGORY_CODE },
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

export function filterLanguageRecordTypes(recordTypes, categories, selectedCategoryId, languageCode) {
  const selected = categories.find((category) => category.id === selectedCategoryId);
  if (!selected) return [];
  if (selected.code !== CONTENT_ROOT_CODE) return recordTypes.filter((type) => type.category_id === selected.id);
  const option = LANGUAGE_OPTIONS.find((item) => item.value === languageCode);
  if (!option) return [];
  const typeCategory = categories.find((category) => category.code === option.typeCategoryCode);
  return typeCategory ? recordTypes.filter((type) => type.category_id === typeCategory.id) : [];
}
