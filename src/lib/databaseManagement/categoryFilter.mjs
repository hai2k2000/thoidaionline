export function expandCategoryFilter(categories, categoryId) {
  if (!categoryId) return null;
  const selected = categories.find((category) => category.id === categoryId);
  if (!selected) return [];
  return [selected.id, ...categories.filter((category) => category.parent_id === selected.id).map((category) => category.id)];
}

export function primaryCategoryForRecord(categories, categoryId) {
  const selected = categories.find((category) => category.id === categoryId);
  if (!selected) return null;
  return selected.parent_id ? categories.find((category) => category.id === selected.parent_id) ?? selected : selected;
}
