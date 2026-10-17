import type { DatabaseRecordAclInput, DatabaseRecordInput, DatabaseRecordUpdateInput } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/;
const URL = /^https:\/\//i;

export type RecordValidationError = { field: string; code: string };

export function validateDatabaseRecordInput(input: unknown): { ok: true; value: DatabaseRecordInput } | { ok: false; errors: RecordValidationError[] } {
  const value = input as Partial<DatabaseRecordInput> | null;
  const errors: RecordValidationError[] = [];
  if (!value || typeof value !== "object") return { ok: false, errors: [{ field: "body", code: "object_required" }] };
  if (typeof value.categoryId !== "string" || !UUID.test(value.categoryId)) errors.push({ field: "categoryId", code: "uuid_required" });
  if (typeof value.recordTypeId !== "string" || !UUID.test(value.recordTypeId)) errors.push({ field: "recordTypeId", code: "uuid_required" });
  if (typeof value.recordCode !== "string" || !CODE.test(value.recordCode.trim())) errors.push({ field: "recordCode", code: "invalid_code" });
  if (typeof value.title !== "string" || value.title.trim().length < 1 || value.title.length > 500) errors.push({ field: "title", code: "invalid_title" });
  if (value.summary !== undefined && value.summary !== null && (typeof value.summary !== "string" || value.summary.length > 5000)) errors.push({ field: "summary", code: "invalid_summary" });
  if (value.departmentId !== undefined && value.departmentId !== null && (typeof value.departmentId !== "string" || !UUID.test(value.departmentId))) errors.push({ field: "departmentId", code: "uuid_required" });
  if (value.ownerId !== undefined && value.ownerId !== null && (typeof value.ownerId !== "string" || !UUID.test(value.ownerId))) errors.push({ field: "ownerId", code: "uuid_required" });
  if (!value.metadata || typeof value.metadata !== "object" || Array.isArray(value.metadata)) errors.push({ field: "metadata", code: "object_required" });
  if (value.keywords !== undefined && (!Array.isArray(value.keywords) || value.keywords.some((keyword) => typeof keyword !== "string" || keyword.trim().length === 0 || keyword.length > 120))) errors.push({ field: "keywords", code: "invalid_keywords" });
  if (value.externalLinks !== undefined && (!Array.isArray(value.externalLinks) || value.externalLinks.some((link) => !link || link.provider !== "google_drive" || typeof link.url !== "string" || !URL.test(link.url)))) errors.push({ field: "externalLinks", code: "invalid_external_link" });
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: {
    categoryId: value.categoryId!, recordTypeId: value.recordTypeId!, recordCode: value.recordCode!.trim(), title: value.title!.trim(),
    summary: value.summary ?? null, departmentId: value.departmentId ?? null, ownerId: value.ownerId ?? null,
    status: value.status ?? "draft", metadata: value.metadata as Record<string, unknown>, keywords: value.keywords ?? [], externalLinks: value.externalLinks ?? [],
  } };
}

export function validateDatabaseRecordUpdateInput(input: unknown): { ok: true; value: DatabaseRecordUpdateInput } | { ok: false; errors: RecordValidationError[] } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, errors: [{ field: "body", code: "object_required" }] };
  const value = input as Record<string, unknown>;
  const errors: RecordValidationError[] = [];
  const result: DatabaseRecordUpdateInput = {};
  if (value.recordCode !== undefined) {
    if (typeof value.recordCode !== "string" || !CODE.test(value.recordCode.trim())) errors.push({ field: "recordCode", code: "invalid_code" }); else result.recordCode = value.recordCode.trim();
  }
  if (value.title !== undefined) {
    if (typeof value.title !== "string" || value.title.trim().length < 1 || value.title.length > 500) errors.push({ field: "title", code: "invalid_title" }); else result.title = value.title.trim();
  }
  if (value.summary !== undefined) {
    if (value.summary !== null && (typeof value.summary !== "string" || value.summary.length > 5000)) errors.push({ field: "summary", code: "invalid_summary" }); else result.summary = value.summary as string | null;
  }
  for (const field of ["departmentId", "ownerId"] as const) {
    if (value[field] !== undefined && value[field] !== null && (typeof value[field] !== "string" || !UUID.test(value[field] as string))) errors.push({ field, code: "uuid_required" });
    else if (value[field] !== undefined) result[field] = value[field] as string | null;
  }
  if (value.status !== undefined && !["draft", "pending_review", "approved", "archived", "deleted"].includes(String(value.status))) errors.push({ field: "status", code: "invalid_status" });
  else if (value.status !== undefined) result.status = value.status as DatabaseRecordInput["status"];
  if (value.metadata !== undefined && (typeof value.metadata !== "object" || value.metadata === null || Array.isArray(value.metadata))) errors.push({ field: "metadata", code: "object_required" });
  else if (value.metadata !== undefined) result.metadata = value.metadata as Record<string, unknown>;
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
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: value as DatabaseRecordAclInput };
}
