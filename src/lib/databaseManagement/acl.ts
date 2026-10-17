import type { DatabaseAclCapability, DatabaseAclEffect, DatabaseAclPrincipalType } from "./types";

export type DatabaseAclActor = { id: string; roleId?: string | null; departmentId?: string | null; permissionCodes: readonly string[] };
export type DatabaseAclRow = { principal_type: DatabaseAclPrincipalType; principal_id: string; capability: DatabaseAclCapability; effect: DatabaseAclEffect };

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
