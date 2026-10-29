import type { DatabaseRecordAclInput, DatabaseRecordInput, DatabaseRecordUpdateInput } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const URL = /^https:\/\//i;

export type RecordValidationError = { field: string; code: string };

export type DatabaseFormField = {
  field_key: string;
  data_type: string;
  required: boolean;
  options?: unknown;
  validation?: unknown;
};

export function validateDatabaseMetadata(metadata: Record<string, unknown>, fields: readonly DatabaseFormField[]) {
  const errors: RecordValidationError[] = [];
  const knownFields = new Set(fields.map((field) => field.field_key));
  for (const key of Object.keys(metadata)) {
    if (!knownFields.has(key)) errors.push({ field: `metadata.${key}`, code: "unknown_field" });
  }
  for (const field of fields) {
    const value = metadata[field.field_key];
    if (field.required && (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0))) {
      errors.push({ field: `metadata.${field.field_key}`, code: "required" });
      continue;
    }
    if (value === undefined || value === null || value === "") continue;
    const validType = field.data_type === "text" || field.data_type === "long_text" ? typeof value === "string"
      : field.data_type === "date" ? typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      : field.data_type === "datetime" ? typeof value === "string" && !Number.isNaN(Date.parse(value))
      : field.data_type === "number" ? typeof value === "number" && Number.isFinite(value)
      : field.data_type === "boolean" ? typeof value === "boolean"
      : field.data_type === "multi_select" ? Array.isArray(value) && value.every((item) => typeof item === "string")
      : ["select", "person", "department", "country", "url"].includes(field.data_type) ? typeof value === "string"
      : false;
    if (!validType) errors.push({ field: `metadata.${field.field_key}`, code: "invalid_type" });
    if (field.data_type === "url" && typeof value === "string" && !URL.test(value)) errors.push({ field: `metadata.${field.field_key}`, code: "invalid_url" });
    const rules = field.validation && typeof field.validation === "object" ? field.validation as Record<string, unknown> : {};
    if (typeof value === "string" && typeof rules.maxLength === "number" && value.length > rules.maxLength) errors.push({ field: `metadata.${field.field_key}`, code: "max_length" });
    if (Array.isArray(value) && typeof rules.maxItems === "number" && value.length > rules.maxItems) errors.push({ field: `metadata.${field.field_key}`, code: "max_items" });
    if (typeof value === "number") {
      if (typeof rules.min === "number" && value < rules.min) errors.push({ field: `metadata.${field.field_key}`, code: "min" });
      if (typeof rules.max === "number" && value > rules.max) errors.push({ field: `metadata.${field.field_key}`, code: "max" });
    }
    if (["select", "multi_select"].includes(field.data_type) && Array.isArray(field.options)) {
      const allowed = new Set(field.options.map((option) => typeof option === "string" ? option : (option as { value?: unknown })?.value).filter((option): option is string => typeof option === "string"));
      const values = Array.isArray(value) ? value : [value];
      if (allowed.size && values.some((option) => typeof option !== "string" || !allowed.has(option))) errors.push({ field: `metadata.${field.field_key}`, code: "invalid_option" });
    }
  }
  return errors;
}

export function validateDatabaseRecordInput(input: unknown): { ok: true; value: DatabaseRecordInput } | { ok: false; errors: RecordValidationError[] } {
  const value = input as Partial<DatabaseRecordInput> | null;
  const errors: RecordValidationError[] = [];
  if (!value || typeof value !== "object") return { ok: false, errors: [{ field: "body", code: "object_required" }] };
  if (typeof value.categoryId !== "string" || !UUID.test(value.categoryId)) errors.push({ field: "categoryId", code: "uuid_required" });
  if (typeof value.recordTypeId !== "string" || !UUID.test(value.recordTypeId)) errors.push({ field: "recordTypeId", code: "uuid_required" });
  if (typeof value.title !== "string" || value.title.trim().length < 1 || value.title.length > 500) errors.push({ field: "title", code: "invalid_title" });
  if (value.summary !== undefined && value.summary !== null && (typeof value.summary !== "string" || value.summary.length > 5000)) errors.push({ field: "summary", code: "invalid_summary" });
  if (value.departmentId !== undefined && value.departmentId !== null && (typeof value.departmentId !== "string" || !UUID.test(value.departmentId))) errors.push({ field: "departmentId", code: "uuid_required" });
  if (value.ownerId !== undefined && value.ownerId !== null && (typeof value.ownerId !== "string" || !UUID.test(value.ownerId))) errors.push({ field: "ownerId", code: "uuid_required" });
  if (!value.metadata || typeof value.metadata !== "object" || Array.isArray(value.metadata)) errors.push({ field: "metadata", code: "object_required" });
  if (value.languageCode !== undefined && value.languageCode !== null && !["vi", "en", "zh", "lo", "km"].includes(value.languageCode)) errors.push({ field: "languageCode", code: "invalid_option" });
  if (value.visibility !== undefined && value.visibility !== "department" && value.visibility !== "public") errors.push({ field: "visibility", code: "invalid_option" });
  if (value.keywords !== undefined && (!Array.isArray(value.keywords) || value.keywords.some((keyword) => typeof keyword !== "string" || keyword.trim().length === 0 || keyword.length > 120))) errors.push({ field: "keywords", code: "invalid_keywords" });
  if (value.externalLinks !== undefined && (!Array.isArray(value.externalLinks) || value.externalLinks.some((link) => !link || link.provider !== "google_drive" || typeof link.url !== "string" || !URL.test(link.url)))) errors.push({ field: "externalLinks", code: "invalid_external_link" });
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: {
    categoryId: value.categoryId!, recordTypeId: value.recordTypeId!, title: value.title!.trim(),
    summary: value.summary ?? null, departmentId: value.departmentId ?? null, ownerId: value.ownerId ?? null,
    status: value.status ?? "draft", metadata: value.metadata as Record<string, unknown>, languageCode: value.languageCode ?? null, keywords: value.keywords ?? [], externalLinks: value.externalLinks ?? [], visibility: value.visibility ?? "department",
  } };
}

export function validateDatabaseRecordUpdateInput(input: unknown): { ok: true; value: DatabaseRecordUpdateInput } | { ok: false; errors: RecordValidationError[] } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, errors: [{ field: "body", code: "object_required" }] };
  const value = input as Record<string, unknown>;
  const errors: RecordValidationError[] = [];
  const result: DatabaseRecordUpdateInput = {};
  if (value.title !== undefined) {
    if (typeof value.title !== "string" || value.title.trim().length < 1 || value.title.length > 500) errors.push({ field: "title", code: "invalid_title" }); else result.title = value.title.trim();
  }
  if (value.summary !== undefined) {
    if (value.summary !== null && (typeof value.summary !== "string" || value.summary.length > 5000)) errors.push({ field: "summary", code: "invalid_summary" }); else result.summary = value.summary as string | null;
  }
  if (value.metadata !== undefined && (typeof value.metadata !== "object" || value.metadata === null || Array.isArray(value.metadata))) errors.push({ field: "metadata", code: "object_required" });
  else if (value.metadata !== undefined) result.metadata = value.metadata as Record<string, unknown>;
  if (value.visibility !== undefined) {
    if (value.visibility !== "department" && value.visibility !== "public") errors.push({ field: "visibility", code: "invalid_option" });
    else result.visibility = value.visibility;
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: result };
}

export function validateDatabaseAclInput(input: unknown): { ok: true; value: DatabaseRecordAclInput } | { ok: false; errors: RecordValidationError[] } {
  const value = input as Partial<DatabaseRecordAclInput> | null;
  const errors: RecordValidationError[] = [];
  if (!value || typeof value !== "object") return { ok: false, errors: [{ field: "body", code: "object_required" }] };
  if (!(["user", "role", "department"] as const).includes(value.principalType as never)) errors.push({ field: "principalType", code: "invalid_principal_type" });
  if (typeof value.principalId !== "string" || !UUID.test(value.principalId)) errors.push({ field: "principalId", code: "uuid_required" });
  if (!(typeof value.capability === "string" && ["discover", "metadata.view", "preview", "download", "edit", "approve", "delete", "restore", "export", "acl.manage"].includes(value.capability))) errors.push({ field: "capability", code: "invalid_capability" });
  if (!(["allow", "deny"] as const).includes(value.effect as never)) errors.push({ field: "effect", code: "invalid_effect" });
  if (value.expiresAt !== undefined && value.expiresAt !== null && (typeof value.expiresAt !== "string" || Number.isNaN(Date.parse(value.expiresAt)))) errors.push({ field: "expiresAt", code: "invalid_datetime" });
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: value as DatabaseRecordAclInput };
}
