import type { DatabaseAclCapability, DatabaseAclEffect, DatabaseAclPrincipalType } from "./types";

export type DatabaseAclActor = { id: string; roleId?: string | null; departmentId?: string | null; permissionCodes: readonly string[] };
export type DatabaseAclRow = { principal_type: DatabaseAclPrincipalType; principal_id: string; capability: DatabaseAclCapability; effect: DatabaseAclEffect };

export type DatabaseDownloadRecord = { status: string; owner_id: string | null; department_id: string | null };
export type DatabaseDownloadDecisionActor = DatabaseAclActor & { permissionScopes?: Record<string, readonly string[]> };

const capabilityPermission = (capability: DatabaseAclCapability) => `record.${capability}`;

export function canAccessDatabaseRecord(actor: DatabaseAclActor, rows: readonly DatabaseAclRow[], capability: DatabaseAclCapability): boolean {
  if (!actor.permissionCodes.includes(capabilityPermission(capability))) return false;
  const applicable = rows.filter((row) => row.capability === capability && (
    row.principal_type === "user" && row.principal_id === actor.id
    || row.principal_type === "role" && row.principal_id === actor.roleId
    || row.principal_type === "department" && row.principal_id === actor.departmentId
  ));
  if (applicable.some((row) => row.effect === "deny")) return false;
  return applicable.some((row) => row.effect === "allow");
}

export function defaultDatabaseRecordAccess(actor: DatabaseAclActor, capability: DatabaseAclCapability, ownerId: string | null, departmentId: string | null): boolean {
  if (!actor.permissionCodes.includes(capabilityPermission(capability))) return false;
  if (actor.id === ownerId && ["discover", "metadata.view", "preview", "download", "edit", "delete", "restore", "export", "acl.manage"].includes(capability)) return true;
  return Boolean(actor.departmentId && departmentId && actor.departmentId === departmentId && capability === "discover");
}

function appliesToActor(actor: DatabaseAclActor, row: DatabaseAclRow) {
  return row.principal_type === "user" && row.principal_id === actor.id
    || row.principal_type === "role" && row.principal_id === actor.roleId
    || row.principal_type === "department" && row.principal_id === actor.departmentId;
}

export function decideDatabaseRecordDownload(actor: DatabaseDownloadDecisionActor, rows: readonly DatabaseAclRow[], record: DatabaseDownloadRecord): boolean {
  if (record.status === "deleted" || !actor.permissionCodes.includes("record.download")) return false;
  const applicable = rows.filter((row) => appliesToActor(actor, row));
  if (applicable.some((row) => row.effect === "deny" && (row.capability === "download" || row.capability === "metadata.view"))) return false;
  const scopes = actor.permissionScopes?.["record.download"] ?? [];
  return applicable.some((row) => row.capability === "download" && row.effect === "allow") || actor.id === record.owner_id || scopes.includes("all") || scopes.includes("department") && Boolean(record.department_id && record.department_id === actor.departmentId) || record.status === "approved" || record.status === "archived";
}

export function databaseRecordMetadataDenied(actor: DatabaseAclActor, rows: readonly DatabaseAclRow[]) {
  return rows.some((row) => row.capability === "metadata.view" && row.effect === "deny" && appliesToActor(actor, row));
}