import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";
import { canAccessDatabaseRecord, defaultDatabaseRecordAccess, type DatabaseAclActor, type DatabaseAclRow } from "./acl";
import { validateDatabaseMetadata } from "./validation";
import { canAccessRecordType } from "./policy";
import type { DatabaseRecordAclInput, DatabaseRecordInput, DatabaseRecordUpdateInput } from "./types";
import { categoryCodeForLanguage, isCompatibleLanguageSelection, languageCodeForCategory } from "./languageGroup.mjs";

type RecordRow = {
  id: string; category_id: string; record_type_id: string; record_code: string; title: string;
  summary: string | null; status: string; department_id: string | null; owner_id: string | null;
  created_by: string; metadata: Record<string, unknown>; language_code?: string | null; form_definition_id?: string | null; deleted_at?: string | null; created_at: string; updated_at: string;
  record_type_code?: string | null;
  record_type_name?: string | null;
  category_code?: string | null;
  category_name?: string | null;
  total_count?: number | null;
};

export type DatabaseRecordActor = { id: string; department_id: string | null; role_code: string; rbacPermissions: string[] };

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

async function canRecord(actor: DatabaseRecordActor, record: Pick<RecordRow, "owner_id" | "department_id" | "record_type_code">, recordId: string, capability: Parameters<typeof canAccessDatabaseRecord>[2]) {
  if (!canAccessRecordType(actor, record.record_type_code)) return false;
  if (!actor.rbacPermissions.includes(`record.${capability}`)) return false;
  const context = await actorContext(actor);
  const rows = await aclForRecord(recordId);
  const explicitDeny = rows.some((row) => row.capability === capability && row.effect === "deny" && (
    row.principal_type === "user" && row.principal_id === actor.id
    || row.principal_type === "role" && row.principal_id === context.roleId
    || row.principal_type === "department" && row.principal_id === context.departmentId
  ));
  if (explicitDeny) return false;
  return canAccessDatabaseRecord(context, rows, capability) || defaultDatabaseRecordAccess(context, capability, record.owner_id, record.department_id);
}

export async function canAccessDatabaseRecordForActor(actor: DatabaseRecordActor, recordId: string, capability: Parameters<typeof canAccessDatabaseRecord>[2]) {
  const record = await getRecord(recordId);
  return Boolean(record && record.status !== "deleted" && canAccessRecordType(actor, record.record_type_code) && await canRecord(actor, record, recordId, capability));
}

async function getRecord(recordId: string) {
  const { data, error } = await serverSupabase.from("db_records").select("id,category_id,record_type_id,form_definition_id,record_code,title,summary,status,department_id,owner_id,created_by,metadata,language_code,created_at,updated_at,deleted_at").eq("id", recordId).maybeSingle();
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
  if (!record || record.status === "deleted") return null;
  if (!canAccessRecordType(actor, record.record_type_code)) return null;
  const metadataAllowed = await canRecord(actor, record, recordId, "metadata.view");
  const discoverAllowed = await canRecord(actor, record, recordId, "discover");
  if (!metadataAllowed && !discoverAllowed) return null;
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
  const canApprove = record.status === "pending_review" && actor.id !== record.created_by && await canRecord(actor, record, recordId, "approve");
  const canSubmit = record.status === "draft" && await canRecord(actor, record, recordId, "edit");
  return {
    record: metadataAllowed ? record : { ...record, summary: null, metadata: {} },
    canApprove,
    canSubmit,
    acl: metadataAllowed ? acl : [],
    files: metadataAllowed ? files.data ?? [] : [],
    externalLinks: metadataAllowed ? links.data ?? [] : [],
    keywords: metadataAllowed ? (keywords.data ?? []).map((row) => row.keyword) : [],
    history: metadataAllowed ? historyRows.map((item) => ({ ...item, actor_name: actorNames.get(item.actor_id) ?? null })) : [],
    approvedBy: latestApproval ? { name: actorNames.get(latestApproval.actor_id) ?? null, at: latestApproval.created_at } : null,
  };
}

export type DatabaseRecordListQuery = { q?: string; status?: string; recordTypeId?: string; categoryId?: string; languageCode?: string; limit?: number; offset?: number };

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
      if (row.created_by !== actor.id && canAccessRecordType(actor, row.record_type_code) && await canRecord(actor, row, row.id, "approve")) {
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
    if (error.code === "42501") throw new Error("permission_denied");
    if (error.code === "P0002") throw new Error("record_not_found");
    if (error.code === "22023") throw new Error(error.message.includes("reason") ? "return_reason_required" : "invalid_transition");
    throw error;
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
  if (!canAccessRecordType(actor, type.code)) throw new Error("record_type_restricted");
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
  const { data, error } = await serverSupabase.from("db_records").update(patch).eq("id", recordId).select("id,category_id,record_type_id,record_code,title,summary,status,department_id,owner_id,created_by,metadata,created_at,updated_at").single();
  if (error) throw error;
  const { error: historyError } = await serverSupabase.from("db_record_history").insert({ record_id: recordId, actor_id: actor.id, action: "update", old_data: current, new_data: data });
  if (historyError) { await serverSupabase.from("db_records").update({ record_code: current.record_code, title: current.title, summary: current.summary, metadata: current.metadata }).eq("id", recordId); throw historyError; }
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
  const { error: historyError } = await serverSupabase.from("db_record_history").insert({ record_id: recordId, actor_id: actor.id, action: "acl_update", old_data: null, new_data: data });
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
  if (!(await canRecord(actor, current, recordId, "download"))) throw new Error("permission_denied");
  const { data, error } = await serverSupabase.from("db_record_files").select("id,record_id,storage_key,original_name,mime_type,size_bytes,sha256").eq("id", fileId).eq("record_id", recordId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("file_not_found");
  return data as { id: string; record_id: string; storage_key: string; original_name: string; mime_type: string; size_bytes: number; sha256: string };
}
