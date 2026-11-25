/**
 * @param {Array<{ sort_order?: number | null; field_key?: string }> | null | undefined} fields
 */
export function sortFormFields(fields) {
  return [...(fields ?? [])].sort((left, right) => {
    const leftOrder = left.sort_order;
    const rightOrder = right.sort_order;
    if (leftOrder == null && rightOrder == null) return String(left.field_key ?? "").localeCompare(String(right.field_key ?? ""));
    if (leftOrder == null) return 1;
    if (rightOrder == null) return -1;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left.field_key ?? "").localeCompare(String(right.field_key ?? ""));
  });
}
