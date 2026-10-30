import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";
import { canAccessDatabaseRecord, defaultDatabaseRecordAccess, type DatabaseAclActor, type DatabaseAclRow } from "./acl";
import { validateDatabaseMetadata } from "./validation";
import { canAccessRecordType } from "./policy";
import type { DatabaseRecordAclInput, DatabaseRecordInput, DatabaseRecordUpdateInput } from "./types";
import { categoryCodeForLanguage, isCompatibleLanguageSelection, languageCodeForCategory } from "./languageGroup.mjs";
import { classifyWorkflowRpcError } from "./workflowErrors.mjs";

type RecordRow = {
  id: string; category_id: string; record_type_id: string; record_code: string; title: string;
  summary: string | null; status: string; department_id: string | null; owner_id: string | null;
  created_by: string; metadata: Record<string, unknown>; language_code?: string | null; form_definition_id?: string | null; deleted_at?: string | null; created_at: string; updated_at: string;
  visibility?: "department" | "public";
  record_type_code?: string | null;
  record_type_name?: string | null;
  category_code?: string | null;
  category_name?: string | null;
  total_count?: number | null;
};

export type DatabaseRecordActor = {
  id: string;
  department_id: string | null;
  role_code: string;
  rbacPermissions: string[];
  rbacPermissionScopes?: Record<string, string[]>;
};

async function actorContext(actor: DatabaseRecordActor): Promise<DatabaseAclActor> {
  const { data, error } = await serverSupabase.from("staff_users").select("role_id").eq("id", actor.id).maybeSingle();
  if (error) throw error;
  return { id: actor.id, roleId: data?.role_id ?? null, departmentId: actor.department_id, permissionCodes: actor.rbacPermissions };
}

async function aclForRecord(recordId: string) {
  const { data, error } = await serverSupabase.from("db_record_acl").select("record_id,principal_type,principal_id,capability,effect,expires_at").eq("record_id", recordId);
  if (error) throw error;
  const now = Date.now();
  return (data ?? []).filter((row) => !row.expires_at || Date.parse(row.expires_at) > now) as Array<DatabaseAclRow & { record_id: string; expires_at?: string | null }>;
}

async function visibilityAllowed(actor: DatabaseRecordActor, record: Pick<RecordRow, "department_id" | "status" | "visibility" | "record_type_code" | "category_code">, recordId: string) {
  if (!canAccessRecordType(actor, record.record_type_code, record.category_code)) return false;
  const context = await actorContext(actor);
  const rows = await aclForRecord(recordId);
  if (rows.some((row) => row.capability === "discover" && row.effect === "deny" && ((row.principal_type === "user" && row.principal_id === actor.id) || (row.principal_type === "role" && row.principal_id === context.roleId) || (row.principal_type === "department" && row.principal_id === context.departmentId)))) return false;
  if (rows.some((row) => row.capability === "discover" && row.effect === "allow" && ((row.principal_type === "user" && row.principal_id === actor.id) || (row.principal_type === "role" && row.principal_id === context.roleId) || (row.principal_type === "department" && row.principal_id === context.departmentId)))) return true;
  if (actor.rbacPermissionScopes?.["record.discover"]?.includes("all")) return true;
  if (record.department_id && record.department_id === actor.department_id) return true;
  if (record.status === "approved" || record.status === "archived") {
    if (record.visibility === "public") return true;
    const { data, error } = await serverSupabase.from("db_department_view_grants").select("user_id").eq("user_id", actor.id).eq("department_id", record.department_id).maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }
  return false;
}

async function canRecord(actor: DatabaseRecordActor, record: Pick<RecordRow, "owner_id" | "department_id" | "record_type_code" | "category_code">, recordId: string, capability: Parameters<typeof canAccessDatabaseRecord>[2]) {
  if (!canAccessRecordType(actor, record.record_type_code, record.category_code)) return false;
  if (!actor.rbacPermissions.includes(`record.${capability}`)) return false;
  const context = await actorContext(actor);
  const rows = await aclForRecord(recordId);
  const explicitDeny = rows.some((row) => row.capability === capability && row.effect === "deny" && (
    row.principal_type === "user" && row.principal_id === actor.id
    || row.principal_type === "role" && row.principal_id === context.roleId
    || row.principal_type === "department" && row.principal_id === context.departmentId
  ));
  if (explicitDeny) return false;
  // ACL managers are granted record-wide management by RBAC; an explicit deny still wins.
  if (capability === "acl.manage") return true;
  return canAccessDatabaseRecord(context, rows, capability) || defaultDatabaseRecordAccess(context, capability, record.owner_id, record.department_id);
}

function hasPermissionScope(actor: DatabaseRecordActor, permission: string, scopes: readonly string[]) {
  if (!actor.rbacPermissions.includes(permission)) return false;
  const effectiveScopes = actor.rbacPermissionScopes?.[permission];
  return Array.isArray(effectiveScopes) && effectiveScopes.some((scope) => scopes.includes(scope));
}

async function canApproveRecord(actor: DatabaseRecordActor, record: Pick<RecordRow, "owner_id" | "department_id" | "record_type_code" | "created_by">, recordId: string) {
  const context = await actorContext(actor);
  const rows = await aclForRecord(recordId);
  if (rows.some((row) => row.capability === "approve" && row.effect === "deny" && ((row.principal_type === "user" && row.principal_id === actor.id) || (row.principal_type === "role" && row.principal_id === context.roleId) || (row.principal_type === "department" && row.principal_id === context.departmentId)))) return false;
  const manager = record.department_id ? Boolean((await serverSupabase.from("departments").select("manager_id").eq("id", record.department_id).maybeSingle()).data?.manager_id === actor.id) : false;
  const approver = manager || actor.rbacPermissionScopes?.["record.approve"]?.includes("all") || (
    actor.rbacPermissionScopes?.["record.approve"]?.includes("department")
    && Boolean(record.department_id)
    && record.department_id === actor.department_id
  );
  if (!approver) return false;
  if (record.created_by !== actor.id) return true;
  return hasPermissionScope(actor, "record.self_approve", ["self", "all"]);
}

export type DatabaseRecordApprovalBlockReason =
  | "record_not_pending"
  | "record_type_restricted"
  | "missing_record_approve_permission"
  | "approval_acl_denied"
  | "missing_approval_acl_allow"
  | "missing_self_approve_permission";

async function approvalBlockReason(actor: DatabaseRecordActor, record: RecordRow, recordId: string): Promise<DatabaseRecordApprovalBlockReason | null> {
  if (record.status !== "pending_review") return "record_not_pending";
  if (!canAccessRecordType(actor, record.record_type_code, record.category_code)) return "record_type_restricted";
  const context = await actorContext(actor);
  const rows = await aclForRecord(recordId);
  const applicable = rows.filter((row) => row.capability === "approve" && ((row.principal_type === "user" && row.principal_id === actor.id) || (row.principal_type === "role" && row.principal_id === context.roleId) || (row.principal_type === "department" && row.principal_id === context.departmentId)));
  if (applicable.some((row) => row.effect === "deny")) return "approval_acl_denied";
  const manager = record.department_id ? Boolean((await serverSupabase.from("departments").select("manager_id").eq("id", record.department_id).maybeSingle()).data?.manager_id === actor.id) : false;
  const departmentApprover = actor.rbacPermissionScopes?.["record.approve"]?.includes("department")
    && Boolean(record.department_id)
    && record.department_id === actor.department_id;
  if (!manager && !actor.rbacPermissionScopes?.["record.approve"]?.includes("all") && !departmentApprover) return "missing_record_approve_permission";
  if (record.created_by === actor.id && !hasPermissionScope(actor, "record.self_approve", ["self", "all"])) return "missing_self_approve_permission";
  return null;
}

export async function canAccessDatabaseRecordForActor(actor: DatabaseRecordActor, recordId: string, capability: Parameters<typeof canAccessDatabaseRecord>[2]) {
  const record = await getRecord(recordId);
  return Boolean(record && record.status !== "deleted" && canAccessRecordType(actor, record.record_type_code, record.category_code) && await canRecord(actor, record, recordId, capability));
}

async function getRecord(recordId: string) {
  const { data, error } = await serverSupabase.from("db_records").select("id,category_id,record_type_id,form_definition_id,record_code,title,summary,status,department_id,owner_id,created_by,metadata,language_code,visibility,created_at,updated_at,deleted_at").eq("id", recordId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [{ data: type, error: typeError }, { data: category, error: categoryError }] = await Promise.all([
    serverSupabase.from("db_record_types").select("code").eq("id", data.record_type_id).maybeSingle(),
    serverSupabase.from("db_categories").select("code,name,parent_id").eq("id", data.category_id).maybeSingle(),
  ]);
  if (typeError || categoryError) throw typeError ?? categoryError;
  return { ...(data as RecordRow & { form_definition_id: string | null; deleted_at: string | null }), language_code: data.language_code ?? languageCodeForCategory(category?.code), category_code: category?.code ?? null, category_name: category?.name ?? null, record_type_code: type?.code ?? null };
}

async function validateFormMetadata(formDefinitionId: string | null | undefined, metadata: Record<string, unknown>) {
  if (!formDefinitionId) return;
  const { data, error } = await serverSupabase.from("db_form_fields").select("field_key,data_type,required,options,validation").eq("form_definition_id", formDefinitionId);
  if (error) throw error;
  const errors = validateDatabaseMetadata(metadata, data ?? []);
  if (errors.length) throw new Error(`invalid_metadata:${JSON.stringify(errors)}`);
}

export async function getVisibleDatabaseRecord(actor: DatabaseRecordActor, recordId: string) {
  const record = await getRecord(recordId);
  if (!record) return null;
  if (!canAccessRecordType(actor, record.record_type_code, record.category_code)) return null;
  const canRestore = record.status === "deleted" && await canRecord(actor, record, recordId, "restore");
  if (record.status === "deleted" && !canRestore) return null;
  const visible = await visibilityAllowed(actor, record, recordId);
  if (!visible && !canRestore) return null;
  const metadataAllowed = visible;
  const [acl, files, links, keywords, history] = await Promise.all([
    aclForRecord(recordId),
    serverSupabase.from("db_record_files").select("id,storage_backend,original_name,mime_type,size_bytes,sha256,created_by,created_at").eq("record_id", recordId).order("created_at", { ascending: false }),
    serverSupabase.from("db_record_external_links").select("id,provider,url,external_file_id,media_kind,usage_rights,link_status,last_verified_at,created_at").eq("record_id", recordId).order("created_at", { ascending: false }),
    serverSupabase.from("db_record_keywords").select("keyword").eq("record_id", recordId).order("keyword"),
    serverSupabase.from("db_record_history").select("id,actor_id,action,old_data,new_data,created_at").eq("record_id", recordId).order("created_at", { ascending: false }).limit(100),
  ]);
  if (files.error || links.error || keywords.error || history.error) throw files.error ?? links.error ?? keywords.error ?? history.error;
  const historyRows = history.data ?? [];
  const actorIds = [...new Set(historyRows.map((item) => item.actor_id).filter(Boolean))];
  const actors = actorIds.length ? await serverSupabase.from("staff_users").select("id,full_name").in("id", actorIds) : { data: [], error: null };
  if (actors.error) throw actors.error;
  const actorNames = new Map((actors.data ?? []).map((item) => [item.id, item.full_name]));
  const latestApproval = historyRows.find((item) => item.action === "approve");
  const canApprove = record.status === "pending_review" && await canApproveRecord(actor, record, recordId);
  const canSubmit = record.status === "draft" && await canRecord(actor, record, recordId, "edit");
  const canDelete = record.status !== "deleted" && await canRecord(actor, record, recordId, "delete");
  const canManageAcl = await canRecord(actor, record, recordId, "acl.manage");
  const blockReason = canManageAcl ? await approvalBlockReason(actor, record, recordId) : null;
  return {
    record: metadataAllowed ? record : { ...record, summary: null, metadata: {} },
    canApprove,
    canSubmit,
    canDelete,
    canRestore,
    canManageAcl,
    approvalBlockReason: blockReason,
    acl: canManageAcl ? acl : [],
    files: metadataAllowed ? files.data ?? [] : [],
    externalLinks: metadataAllowed ? links.data ?? [] : [],
    keywords: metadataAllowed ? (keywords.data ?? []).map((row) => row.keyword) : [],
    history: metadataAllowed ? historyRows.map((item) => ({ ...item, actor_name: actorNames.get(item.actor_id) ?? null })) : [],
    approvedBy: latestApproval ? { name: actorNames.get(latestApproval.actor_id) ?? null, at: latestApproval.created_at } : null,
  };
}

export async function getDatabaseRecordAclManagement(actor: DatabaseRecordActor, recordId: string) {
  const record = await getRecord(recordId);
  if (!record || record.status === "deleted") throw new Error("record_not_found");
  if (!(await canRecord(actor, record, recordId, "acl.manage"))) throw new Error("permission_denied");
  const [acl, users, roles] = await Promise.all([
    serverSupabase.from("db_record_acl").select("id,record_id,principal_type,principal_id,capability,effect,expires_at,created_at").eq("record_id", recordId).order("capability").order("principal_type"),
    serverSupabase.from("staff_users").select("id,full_name,username,active").eq("active", true).order("full_name"),
    serverSupabase.from("roles").select("id,code,name,active").eq("active", true).order("name"),
  ]);
  if (acl.error || users.error || roles.error) throw acl.error ?? users.error ?? roles.error;
  return { acl: acl.data ?? [], users: users.data ?? [], roles: roles.data ?? [] };
}

export type DatabaseRecordListQuery = { q?: string; status?: string; visibility?: "department" | "public"; recordTypeId?: string; categoryId?: string; languageCode?: string; limit?: number; offset?: number; createdFrom?: string; createdTo?: string; updatedFrom?: string; updatedTo?: string; departmentId?: string; ownerId?: string; createdBy?: string; hasFiles?: boolean; keyword?: string; sort?: string; sortDir?: string };

export async function listVisibleDatabaseRecords(actor: DatabaseRecordActor, filters: DatabaseRecordListQuery = {}) {
  let categoryId = filters.categoryId ?? null;
  if (categoryId && filters.languageCode) {
    const selected = await serverSupabase.from("db_categories").select("code").eq("id", categoryId).maybeSingle();
    if (selected.error) throw selected.error;
    if (selected.data?.code !== "phong_noi_dung") return [];
  }
  if (filters.languageCode) {
    const categoryCode = categoryCodeForLanguage(filters.languageCode);
    if (!categoryCode) return [];
    const category = await serverSupabase.from("db_categories").select("id").eq("code", categoryCode).maybeSingle();
    if (category.error) throw category.error;
    if (!category.data) return [];
    categoryId = category.data.id;
  }
  const { data, error } = await serverSupabase.rpc("api_search_database_records", {
    p_actor_id: actor.id,
    p_q: filters.q?.trim() || null,
    p_status: filters.status ?? null,
    p_record_type_id: filters.recordTypeId ?? null,
    p_category_id: categoryId,
    p_limit: Math.min(Math.max(filters.limit ?? 200, 1), 100),
    p_offset: Math.max(filters.offset ?? 0, 0),
    p_created_from: filters.createdFrom ?? null,
    p_created_to: filters.createdTo ?? null,
    p_updated_from: filters.updatedFrom ?? null,
    p_updated_to: filters.updatedTo ?? null,
    p_department_id: filters.departmentId ?? null,
    p_owner_id: filters.ownerId ?? null,
    p_created_by: filters.createdBy ?? null,
    p_has_files: filters.hasFiles ?? null,
    p_keyword: filters.keyword?.trim() || null,
    p_sort: filters.sort ?? "updated_at",
    p_sort_dir: filters.sortDir ?? "desc",
    p_visibility: filters.visibility ?? null,
  });
  if (error) throw error;
  const rows = (data ?? []) as RecordRow[];
  const typeIds = [...new Set(rows.map((row) => row.record_type_id))];
  const types = typeIds.length
    ? await serverSupabase.from("db_record_types").select("id,code,name").in("id", typeIds)
    : { data: [], error: null };
  if (types.error) throw types.error;
  const typeById = new Map((types.data ?? []).map((type) => [type.id, type]));
  const categoryIds = [...new Set(rows.map((row) => row.category_id))];
  if (!categoryIds.length) return rows.map((row) => ({ ...row, record_type_code: typeById.get(row.record_type_id)?.code ?? null, record_type_name: typeById.get(row.record_type_id)?.name ?? null }));
  const categories = await serverSupabase.from("db_categories").select("id,code,name,parent_id").in("id", categoryIds);
  if (categories.error) throw categories.error;
  const parentIds = [...new Set((categories.data ?? []).map((category) => category.parent_id).filter(Boolean))];
  const parents = parentIds.length ? await serverSupabase.from("db_categories").select("id,code,name").in("id", parentIds) : { data: [], error: null };
  if (parents.error) throw parents.error;
  const parentById = new Map((parents.data ?? []).map((category) => [category.id, category]));
  const categoryById = new Map((categories.data ?? []).map((category) => [category.id, category]));
  const languageByCategory = new Map((categories.data ?? []).map((category) => [category.id, languageCodeForCategory(category.code)]));
  return rows.map((row) => ({
    ...row,
    language_code: row.language_code ?? languageByCategory.get(row.category_id) ?? null,
    category_code: (parentById.get(categoryById.get(row.category_id)?.parent_id ?? "") ?? categoryById.get(row.category_id))?.code ?? null,
    category_name: (parentById.get(categoryById.get(row.category_id)?.parent_id ?? "") ?? categoryById.get(row.category_id))?.name ?? null,
    record_type_code: typeById.get(row.record_type_id)?.code ?? null,
    record_type_name: typeById.get(row.record_type_id)?.name ?? null,
  }));
}

export async function listVisibleApprovalQueue(actor: DatabaseRecordActor, filters: Omit<DatabaseRecordListQuery, "status"> = {}) {
  const approved: RecordRow[] = [];
  let offset = 0;
  let total = 0;
  do {
    const page = await listVisibleDatabaseRecords(actor, { ...filters, status: "pending_review", limit: 100, offset });
    total = Number(page[0]?.total_count ?? offset + page.length);
    for (const row of page) {
      if (canAccessRecordType(actor, row.record_type_code, row.category_code) && await canApproveRecord(actor, row, row.id)) {
        approved.push(row);
      }
    }
    offset += page.length;
    if (page.length === 0 || page.length < 100) break;
  } while (offset < total);
  const totalCount = approved.length;
  const offsetValue = Math.max(filters.offset ?? 0, 0);
  const limitValue = Math.min(Math.max(filters.limit ?? 20, 1), 100);
  return approved.slice(offsetValue, offsetValue + limitValue).map((row) => ({ ...row, total_count: totalCount }));
}

export type DatabaseRecordWorkflowAction = "submit" | "approve" | "return";

export async function transitionDatabaseRecord(actor: DatabaseRecordActor, recordId: string, action: DatabaseRecordWorkflowAction, reason?: string) {
  const { data, error } = await serverSupabase.rpc("api_transition_database_record", {
    p_actor_id: actor.id,
    p_record_id: recordId,
    p_action: action,
    p_reason: reason?.trim() || null,
  });
  if (error) {
    throw new Error(classifyWorkflowRpcError(error));
  }
  return (data?.[0] ?? data) as { id: string; status: string; action: string; reason: string | null; replayed: boolean };
}

export async function createDatabaseRecord(actor: DatabaseRecordActor, input: DatabaseRecordInput, clientRequestId?: string) {
  if (!actor.rbacPermissions.includes("record.create")) throw new Error("permission_denied");
  if (!actor.department_id) throw new Error("department_required");
  if (clientRequestId) {
    const { data: existing, error: existingError } = await serverSupabase.from("db_records").select("id,category_id,record_type_id,record_code,title,summary,status,department_id,owner_id,created_by,metadata,language_code,created_at,updated_at").eq("created_by", actor.id).eq("client_request_id", clientRequestId).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return existing as RecordRow;
  }
  const { data: category, error: categoryError } = await serverSupabase.from("db_categories").select("id,parent_id,code,department_id,active").eq("id", input.categoryId).eq("active", true).maybeSingle();
  if (categoryError) throw categoryError;
  const { data: type, error: typeError } = await serverSupabase.from("db_record_types").select("id,category_id,active,code").eq("id", input.recordTypeId).eq("active", true).maybeSingle();
  if (typeError) throw typeError;
  if (!category || !type || (category.department_id && category.department_id !== actor.department_id)) throw new Error("record_scope_forbidden");
  const languageCode = input.languageCode ?? null;
  const effectiveCategoryCode = category.code === "phong_noi_dung" ? categoryCodeForLanguage(languageCode) : category.code;
  const effectiveCategory = effectiveCategoryCode && effectiveCategoryCode !== category.code
    ? await serverSupabase.from("db_categories").select("id").eq("code", effectiveCategoryCode).maybeSingle()
    : { data: category, error: null };
  if (effectiveCategory.error) throw effectiveCategory.error;
  if (!effectiveCategory.data) throw new Error("language_required");
  const typeCategory = await serverSupabase.from("db_categories").select("code").eq("id", type.category_id).maybeSingle();
  if (typeCategory.error) throw typeCategory.error;
  if (!effectiveCategoryCode || !isCompatibleLanguageSelection(effectiveCategoryCode, typeCategory.data?.code ?? "", languageCode)) throw new Error(category.code === "phong_noi_dung" || category.parent_id ? "language_required" : "record_scope_forbidden");
  if (!canAccessRecordType(actor, type.code, typeCategory.data?.code)) throw new Error("record_type_restricted");
  const { data: form, error: formError } = await serverSupabase.from("db_form_definitions").select("id").eq("record_type_id", input.recordTypeId).eq("status", "published").order("version", { ascending: false }).limit(1).maybeSingle();
  if (formError) throw formError;
  await validateFormMetadata(form?.id, { ...input.metadata, record_code: "HS-0000-000000", title: input.title, summary: input.summary ?? "", status: "draft" });
  const { data: generatedCode, error: codeError } = await serverSupabase.rpc("api_next_database_record_code");
  if (codeError || typeof generatedCode !== "string") throw codeError ?? new Error("record_code_generation_failed");
  const { data, error } = await serverSupabase.from("db_records").insert({
    category_id: effectiveCategory.data.id,
    record_type_id: input.recordTypeId,
    record_code: generatedCode,
    title: input.title,
    summary: input.summary ?? null,
    department_id: actor.department_id,
    owner_id: actor.id,
    created_by: actor.id,
    status: "draft",
    metadata: input.metadata,
    language_code: languageCodeForCategory(category.code) ?? languageCode,
    form_definition_id: form?.id ?? null,
    visibility: input.visibility ?? "department",
    ...(clientRequestId ? { client_request_id: clientRequestId } : {}),
  }).select("id,category_id,record_type_id,record_code,title,summary,status,department_id,owner_id,created_by,metadata,language_code,created_at,updated_at").single();
  if (error) {
    if (clientRequestId && error.code === "23505") {
      const { data: existing, error: retryError } = await serverSupabase.from("db_records").select("id,category_id,record_type_id,record_code,title,summary,status,department_id,owner_id,created_by,metadata,language_code,created_at,updated_at").eq("created_by", actor.id).eq("client_request_id", clientRequestId).maybeSingle();
      if (!retryError && existing) return existing as RecordRow;
    }
    throw error;
  }
  if (input.keywords?.length) {
    const { error: keywordError } = await serverSupabase.from("db_record_keywords").insert(input.keywords.map((keyword) => ({ record_id: data.id, keyword: keyword.trim() })));
    if (keywordError) { await cleanupNewRecord(data.id); throw keywordError; }
  }
  if (input.externalLinks?.length) {
    const { error: linkError } = await serverSupabase.from("db_record_external_links").insert(input.externalLinks.map((link) => ({ record_id: data.id, provider: link.provider, url: link.url, media_kind: link.mediaKind ?? null, created_by: actor.id })));
    if (linkError) { await cleanupNewRecord(data.id); throw linkError; }
  }
  const { error: historyError } = await serverSupabase.from("db_record_history").insert({ record_id: data.id, actor_id: actor.id, action: "create", old_data: null, new_data: data });
  if (historyError) { await cleanupNewRecord(data.id); throw historyError; }
  return data as RecordRow;
}

async function cleanupNewRecord(recordId: string) {
  await serverSupabase.from("db_record_keywords").delete().eq("record_id", recordId);
  await serverSupabase.from("db_record_external_links").delete().eq("record_id", recordId);
  await serverSupabase.from("db_records").delete().eq("id", recordId);
}

export async function updateDatabaseRecord(actor: DatabaseRecordActor, recordId: string, input: DatabaseRecordUpdateInput) {
  const current = await getRecord(recordId);
  if (!current || current.status === "deleted") throw new Error("record_not_found");
  if (!(await canRecord(actor, current, recordId, "edit"))) throw new Error("permission_denied");
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.metadata !== undefined) {
    await validateFormMetadata(current.form_definition_id, { ...input.metadata, record_code: current.record_code, title: input.title ?? current.title, summary: input.summary ?? current.summary ?? "", status: current.status });
    patch.metadata = input.metadata;
  }
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  const { data, error } = await serverSupabase.from("db_records").update(patch).eq("id", recordId).select("id,category_id,record_type_id,record_code,title,summary,status,department_id,owner_id,created_by,metadata,visibility,created_at,updated_at").single();
  if (error) throw error;
  const { error: historyError } = await serverSupabase.from("db_record_history").insert({ record_id: recordId, actor_id: actor.id, action: "update", old_data: current, new_data: data });
  if (historyError) { await serverSupabase.from("db_records").update({ record_code: current.record_code, title: current.title, summary: current.summary, metadata: current.metadata, visibility: current.visibility }).eq("id", recordId); throw historyError; }
  return data as RecordRow;
}

export async function setDatabaseRecordStatus(actor: DatabaseRecordActor, recordId: string, status: "deleted" | "draft") {
  const current = await getRecord(recordId);
  if (!current) throw new Error("record_not_found");
  const capability = status === "deleted" ? "delete" : "restore";
  if (!(await canRecord(actor, current, recordId, capability))) throw new Error("permission_denied");
  const { data, error } = await serverSupabase.from("db_records").update({ status, deleted_at: status === "deleted" ? new Date().toISOString() : null }).eq("id", recordId).select("id,status,deleted_at,updated_at").single();
  if (error) throw error;
  const { error: historyError } = await serverSupabase.from("db_record_history").insert({ record_id: recordId, actor_id: actor.id, action: status === "deleted" ? "soft_delete" : "restore", old_data: current, new_data: data });
  if (historyError) {
    await serverSupabase.from("db_records").update({ status: current.status, deleted_at: current.deleted_at ?? null }).eq("id", recordId);
    throw historyError;
  }
  return data;
}

export async function upsertDatabaseRecordAcl(actor: DatabaseRecordActor, recordId: string, input: DatabaseRecordAclInput) {
  const current = await getRecord(recordId);
  if (!current) throw new Error("record_not_found");
  if (!(await canRecord(actor, current, recordId, "acl.manage"))) throw new Error("permission_denied");
  const { data: previous, error: previousError } = await serverSupabase.from("db_record_acl").select("id,record_id,principal_type,principal_id,capability,effect,granted_by,expires_at,created_at").eq("record_id", recordId).eq("principal_type", input.principalType).eq("principal_id", input.principalId).eq("capability", input.capability).maybeSingle();
  if (previousError) throw previousError;
  const { data, error } = await serverSupabase.from("db_record_acl").upsert({ record_id: recordId, principal_type: input.principalType, principal_id: input.principalId, capability: input.capability, effect: input.effect, granted_by: actor.id, expires_at: input.expiresAt ?? null }, { onConflict: "record_id,principal_type,principal_id,capability" }).select("id,record_id,principal_type,principal_id,capability,effect,expires_at,created_at").single();
  if (error) throw error;
  const { error: historyError } = await serverSupabase.from("db_record_history").insert({ record_id: recordId, actor_id: actor.id, action: "acl_update", old_data: previous, new_data: data });
  if (historyError) {
    if (previous) await serverSupabase.from("db_record_acl").update({ effect: previous.effect, granted_by: previous.granted_by, expires_at: previous.expires_at }).eq("id", previous.id);
    else await serverSupabase.from("db_record_acl").delete().eq("id", data.id);
    throw historyError;
  }
  return data;
}

export async function getDatabaseRecordFile(actor: DatabaseRecordActor, recordId: string, fileId: string) {
  const current = await getRecord(recordId);
  if (!current || current.status === "deleted") throw new Error("record_not_found");
  if (!(await visibilityAllowed(actor, current, recordId))) throw new Error("permission_denied");
  const { data, error } = await serverSupabase.from("db_record_files").select("id,record_id,storage_key,original_name,mime_type,size_bytes,sha256").eq("id", fileId).eq("record_id", recordId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("file_not_found");
  return data as { id: string; record_id: string; storage_key: string; original_name: string; mime_type: string; size_bytes: number; sha256: string };
}
