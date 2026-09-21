import type { RbacPermissionCode } from "./permissionCatalog";
import type { RbacActor, RbacResource, RbacScope } from "./types";

export function scopesFor(actor: RbacActor, permission: string): RbacScope[] {
  return [...new Set(
    actor.grants
      .filter((grant) => grant.permissionCode === permission)
      .map((grant) => grant.scope),
  )];
}

export function hasPermission(actor: RbacActor, permission: RbacPermissionCode | string): boolean {
  return scopesFor(actor, permission).length > 0;
}

function taskScopeMatches(actor: RbacActor, scope: RbacScope, task: Extract<RbacResource, { kind: "task" }>): boolean {
  if (scope === "all") return true;
  if (scope === "self") {
    return [task.createdBy, task.ownerId].includes(actor.id);
  }
  if (scope === "assigned") {
    return [task.ownerId, task.assigneeId, task.reviewerId].includes(actor.id)
      || task.participantIds?.includes(actor.id) === true;
  }
  return actor.departmentId !== null
    && task.departmentId !== null
    && actor.departmentId === task.departmentId;
}

export function can(actor: RbacActor, permission: RbacPermissionCode | string, resource?: RbacResource): boolean {
  const scopes = scopesFor(actor, permission);
  if (scopes.length === 0) return false;
  if (!resource) return true;
  if (resource.kind !== "task") return false;
  return scopes.some((scope) => taskScopeMatches(actor, scope, resource));
}

export function assertPermission(actor: RbacActor, permission: RbacPermissionCode | string, resource?: RbacResource): void {
  if (!can(actor, permission, resource)) {
    throw new Error("permission_denied");
  }
}
