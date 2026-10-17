import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";
import { canAccessDatabaseRecord, defaultDatabaseRecordAccess, type DatabaseAclActor, type DatabaseAclRow } from "./acl";
import { validateDatabaseMetadata } from "./validation";
import { canAccessRecordType } from "./policy";
import type { DatabaseRecordAclInput, DatabaseRecordInput, DatabaseRecordUpdateInput } from "./types";

type RecordRow = {
  id: string; category_id: string; record_type_id: string; record_code: string; title: string;
  summary: string | null; status: string; department_id: string | null; owner_id: string | null;
  created_by: string; metadata: Record<string, unknown>; form_definition_id?: string | null; deleted_at?: string | null; created_at: string; updated_at: string;
  record_type_code?: string | null;
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

function hasExplicitDeny(actor: DatabaseAclActor, rows: readonly DatabaseAclRow[], capability: Parameters<typeof canAccessDatabaseRecord>[2]) {
  return rows.some((row) => row.capability === capability && row.effect === "deny" && (
    row.principal_type === "user" && row.principal_id === actor.id
    || row.principal_type === "role" && row.principal_id === actor.roleId
    || row.principal_type === "department" && row.principal_id === actor.departmentId
  ));
}

export async function canAccessDatabaseRecordForActor(actor: DatabaseRecordActor, recordId: string, capability: Parameters<typeof canAccessDatabaseRecord>[2]) {
  const record = await getRecord(recordId);
  return Boolean(record && record.status !== "deleted" && canAccessRecordType(actor, record.record_type_code) && await canRecord(actor, record, recordId, capability));
}

async function getRecord(recordId: string) {
  const { data, error } = await serverSupabase.from("db_records").select("id,category_id,record_type_id,form_definition_id,record_code,title,summary,status,department_id,owner_id,created_by,metadata,created_at,updated_at,deleted_at").eq("id", recordId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: type, error: typeError } = await serverSupabase.from("db_record_types").select("code").eq("id", data.record_type_id).maybeSingle();
  if (typeError) throw typeError;
  return { ...(data as RecordRow & { form_definition_id: string | null; deleted_at: string | null }), record_type_code: type?.code ?? null };
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
  return {
    record: metadataAllowed ? record : { ...record, summary: null, metadata: {} },
    acl: metadataAllowed ? acl : [],
    files: metadataAllowed ? files.data ?? [] : [],
    externalLinks: metadataAllowed ? links.data ?? [] : [],
    keywords: metadataAllowed ? (keywords.data ?? []).map((row) => row.keyword) : [],
    history: metadataAllowed ? history.data ?? [] : [],
  };
}

export type DatabaseRecordListQuery = { q?: string; status?: string; recordTypeId?: string; categoryId?: string; limit?: number };

export async function listVisibleDatabaseRecords(actor: DatabaseRecordActor, filters: DatabaseRecordListQuery = {}) {
  const context = await actorContext(actor);
  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 200);
  const { data: typeRows, error: typeError } = await serverSupabase.from("db_record_types").select("id,code").eq("active", true);
  if (typeError) throw typeError;
  const allowedTypeIds = (typeRows ?? []).filter((type) => canAccessRecordType(actor, type.code)).map((type) => type.id);
  if (!allowedTypeIds.length) return [];
  const rows: RecordRow[] = [];
  const maxRowsToScan = Math.max(limit * 10, 1000);
  for (let offset = 0; rows.length < maxRowsToScan; offset += 200) {
    let request = serverSupabase.from("db_records").select("id,category_id,record_type_id,record_code,title,summary,status,department_id,owner_id,created_by,metadata,created_at,updated_at").neq("status", "deleted").in("record_type_id", allowedTypeIds).order("updated_at", { ascending: false }).range(offset, offset + 199);
    if (filters.q?.trim()) {
      const query = filters.q.trim().replace(/[%_,()]/g, " ");
      request = request.or(`title.ilike.%${query}%,record_code.ilike.%${query}%,summary.ilike.%${query}%`);
    }
    if (filters.status) request = request.eq("status", filters.status);
    if (filters.recordTypeId) request = request.eq("record_type_id", filters.recordTypeId);
    if (filters.categoryId) request = request.eq("category_id", filters.categoryId);
    const { data, error } = await request;
    if (error) throw error;
    rows.push(...((data ?? []) as RecordRow[]));
    if ((data ?? []).length < 200) break;
  }
  if (!rows.length) return [];
  const byRecord = new Map<string, DatabaseAclRow[]>();
  for (let offset = 0; offset < rows.length; offset += 500) {
    const { data: acl, error: aclError } = await serverSupabase.from("db_record_acl").select("record_id,principal_type,principal_id,capability,effect,expires_at").in("record_id", rows.slice(offset, offset + 500).map((row) => row.id));
    if (aclError) throw aclError;
    for (const row of (acl ?? []) as Array<DatabaseAclRow & { record_id: string; expires_at?: string | null }>) {
      if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) continue;
      byRecord.set(row.record_id, [...(byRecord.get(row.record_id) ?? []), row]);
    }
  }
  const visible = (await Promise.all(rows.map(async (row) => {
    const aclRows = byRecord.get(row.id) ?? [];
    if (hasExplicitDeny(context, aclRows, "discover")) return null;
    const visible = canAccessDatabaseRecord(context, aclRows, "discover") || defaultDatabaseRecordAccess(context, "discover", row.owner_id, row.department_id);
    if (!visible) return null;
    const metadataVisible = !hasExplicitDeny(context, aclRows, "metadata.view") && (canAccessDatabaseRecord(context, aclRows, "metadata.view") || defaultDatabaseRecordAccess(context, "metadata.view", row.owner_id, row.department_id));
    return metadataVisible ? row : { ...row, summary: null, metadata: {} };
  }))).filter((row): row is RecordRow => row !== null);
  return visible.slice(0, limit);
}

export async function createDatabaseRecord(actor: DatabaseRecordActor, input: DatabaseRecordInput) {
  if (!actor.rbacPermissions.includes("record.create")) throw new Error("permission_denied");
  if (!actor.department_id) throw new Error("department_required");
  const { data: category, error: categoryError } = await serverSupabase.from("db_categories").select("id,department_id,active").eq("id", input.categoryId).eq("active", true).maybeSingle();
  if (categoryError) throw categoryError;
  const { data: type, error: typeError } = await serverSupabase.from("db_record_types").select("id,category_id,active,code").eq("id", input.recordTypeId).eq("active", true).maybeSingle();
  if (typeError) throw typeError;
  if (!category || !type || type.category_id !== category.id || (category.department_id && category.department_id !== actor.department_id)) throw new Error("record_scope_forbidden");
  if (!canAccessRecordType(actor, type.code)) throw new Error("record_type_restricted");
  const { data: form, error: formError } = await serverSupabase.from("db_form_definitions").select("id").eq("record_type_id", input.recordTypeId).eq("status", "published").order("version", { ascending: false }).limit(1).maybeSingle();
  if (formError) throw formError;
  await validateFormMetadata(form?.id, { ...input.metadata, record_code: input.recordCode, title: input.title, summary: input.summary ?? "", status: "draft" });
  const { data, error } = await serverSupabase.from("db_records").insert({
    category_id: input.categoryId,
    record_type_id: input.recordTypeId,
    record_code: input.recordCode,
    title: input.title,
    summary: input.summary ?? null,
    department_id: actor.department_id,
    owner_id: actor.id,
    created_by: actor.id,
    status: "draft",
    metadata: input.metadata,
    form_definition_id: form?.id ?? null,
  }).select("id,category_id,record_type_id,record_code,title,summary,status,department_id,owner_id,created_by,metadata,created_at,updated_at").single();
  if (error) throw error;
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
  if (input.recordCode !== undefined) patch.record_code = input.recordCode;
  if (input.title !== undefined) patch.title = input.title;
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.metadata !== undefined) {
    await validateFormMetadata(current.form_definition_id, { ...input.metadata, record_code: input.recordCode ?? current.record_code, title: input.title ?? current.title, summary: input.summary ?? current.summary ?? "", status: current.status });
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
