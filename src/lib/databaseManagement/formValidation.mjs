export function validateRecordForm({ mode, categoryId, recordTypeId, title, metadata, fields }) {
  const errors = [];
  if (mode === "create" && !categoryId) errors.push({ field: "categoryId", code: "required" });
  if (mode === "create" && !recordTypeId) errors.push({ field: "recordTypeId", code: "required" });
  if (typeof title !== "string" || !title.trim()) errors.push({ field: "title", code: "invalid_title" });
  for (const field of fields ?? []) {
    if (["record_code", "title", "summary", "status"].includes(field.field_key)) continue;
    const value = metadata?.[field.field_key];
    const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    if (field.required && empty) {
      errors.push({ field: `metadata.${field.field_key}`, code: "required" });
      continue;
    }
    if (empty) continue;
    const validType = field.data_type === "text" || field.data_type === "long_text" ? typeof value === "string"
      : field.data_type === "date" ? typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      : field.data_type === "datetime" ? typeof value === "string" && !Number.isNaN(Date.parse(value))
      : field.data_type === "number" ? typeof value === "number" && Number.isFinite(value)
      : field.data_type === "boolean" ? typeof value === "boolean"
      : field.data_type === "multi_select" ? Array.isArray(value) && value.every((item) => typeof item === "string")
      : ["select", "person", "department", "country", "url"].includes(field.data_type) ? typeof value === "string"
      : false;
    if (!validType) errors.push({ field: `metadata.${field.field_key}`, code: "invalid_type" });
    if (field.data_type === "url" && typeof value === "string" && !/^https:\/\//i.test(value)) errors.push({ field: `metadata.${field.field_key}`, code: "invalid_url" });
    const rules = field.validation && typeof field.validation === "object" ? field.validation : {};
    if (typeof value === "string" && typeof rules.maxLength === "number" && value.length > rules.maxLength) errors.push({ field: `metadata.${field.field_key}`, code: "max_length" });
    if (Array.isArray(value) && typeof rules.maxItems === "number" && value.length > rules.maxItems) errors.push({ field: `metadata.${field.field_key}`, code: "max_items" });
    if (["select", "multi_select"].includes(field.data_type) && Array.isArray(field.options) && field.options.length) {
      const allowed = new Set(field.options.map((option) => typeof option === "string" ? option : option?.value).filter((option) => typeof option === "string"));
      const values = Array.isArray(value) ? value : [value];
      if (values.some((option) => !allowed.has(option))) errors.push({ field: `metadata.${field.field_key}`, code: "invalid_option" });
    }
  }
  return errors;
}
