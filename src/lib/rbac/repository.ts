import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";
import { hasPermission } from "./authorization";
import type { EffectivePermission, RbacActor, RbacGrant, RbacScope } from "./types";

type EffectivePermissionRow = {
  permission_code: string;
  permission_name: string;
  module: string;
  description: string | null;
  role_scopes: RbacScope[];
  user_effect: "allow" | "deny" | null;
  user_scope: RbacScope | null;
  effective_scopes: RbacScope[];
  source: "role" | "user_allow" | "user_deny" | "none";
  actor_active: boolean;
  role_active: boolean;
};

export type EffectivePermissionCatalogRow = EffectivePermissionRow;

export async function loadRbacActor(actor: { id: string; department_id: string | null }): Promise<RbacActor> {
  // api_list_role_permission_grants remains a database compatibility wrapper;
  // all new server callers use the deny-aware effective resolver below.
  const { data, error } = await serverSupabase.rpc("api_list_effective_permissions", { p_actor_id: actor.id });
  if (error) throw error;
  const permissions = ((data ?? []) as EffectivePermissionRow[]).map((row): EffectivePermission => ({
    permissionCode: row.permission_code,
    roleScopes: row.role_scopes ?? [],
    userEffect: row.user_effect ?? null,
    userScope: row.user_scope ?? null,
    effectiveScopes: row.effective_scopes ?? [],
    source: row.source,
  }));
  const grants = permissions.flatMap((permission): RbacGrant[] => permission.effectiveScopes.map((scope) => ({
    permissionCode: permission.permissionCode,
    scope,
  })));
  return { id: actor.id, departmentId: actor.department_id, grants, permissions };
}

export async function loadEffectivePermissionCatalog(actor: { id: string }): Promise<EffectivePermissionCatalogRow[]> {
  const { data, error } = await serverSupabase.rpc("api_list_effective_permissions", { p_actor_id: actor.id });
  if (error) throw error;
  return (data ?? []) as EffectivePermissionCatalogRow[];
}

export async function replaceRolePermissions(actor: RbacActor, roleId: string, grants: unknown[]) {
  if (!hasPermission(actor, "permission.manage")) {
    throw Object.assign(new Error("permission_denied"), { code: "42501" });
  }
  const { data, error } = await serverSupabase.rpc("api_replace_role_permissions", {
    p_actor_id: actor.id,
    p_role_id: roleId,
    p_grants: grants,
  });
  if (error) throw error;
  return data;
}

export async function setUserPermissionOverride(actor: RbacActor, userId: string, permissionCode: string, effect: "allow" | "deny", scope: RbacScope) {
  if (!hasPermission(actor, "permission.manage")) {
    throw Object.assign(new Error("permission_denied"), { code: "42501" });
  }
  const { data, error } = await serverSupabase.rpc("api_set_user_permission_override", {
    p_actor_id: actor.id,
    p_user_id: userId,
    p_permission_code: permissionCode,
    p_effect: effect,
    p_scope: scope,
  });
  if (error) throw error;
  return data;
}

export async function restoreUserPermissionInheritance(actor: RbacActor, userId: string) {
  if (!hasPermission(actor, "permission.manage")) {
    throw Object.assign(new Error("permission_denied"), { code: "42501" });
  }
  const { data, error } = await serverSupabase.rpc("api_restore_user_permission_inheritance", {
    p_actor_id: actor.id,
    p_user_id: userId,
  });
  if (error) throw error;
  return data;
}

export async function clearUserPermissionOverride(actor: RbacActor, userId: string, permissionCode: string) {
  if (!hasPermission(actor, "permission.manage")) {
    throw Object.assign(new Error("permission_denied"), { code: "42501" });
  }
  const { data, error } = await serverSupabase.rpc("api_clear_user_permission_override", {
    p_actor_id: actor.id,
    p_user_id: userId,
    p_permission_code: permissionCode,
  });
  if (error) throw error;
  return data;
}

export function createRbacRequestContext() {
  const actors = new Map<string, Promise<RbacActor>>();
  return {
    load(actor: { id: string; department_id: string | null }) {
      const cached = actors.get(actor.id);
      if (cached) return cached;
      const pending = loadRbacActor(actor);
      actors.set(actor.id, pending);
      return pending;
    },
  };
}

export async function setQuickReportUserPermission(
  actor: RbacActor,
  userId: string,
  granted: boolean,
) {
  if (!hasPermission(actor, "permission.manage")) {
    throw Object.assign(new Error("permission_denied"), { code: "42501" });
  }
  const { data, error } = await serverSupabase.rpc("api_set_user_quick_report_permission", {
    p_actor_id: actor.id,
    p_user_id: userId,
    p_granted: granted,
  });
  if (error) throw error;
  return data;
}


export async function setAssetManageUserPermission(
  actor: RbacActor,
  userId: string,
  granted: boolean,
) {
  if (!hasPermission(actor, "permission.manage")) {
    throw Object.assign(new Error("permission_denied"), { code: "42501" });
  }
  const { data, error } = await serverSupabase.rpc("api_set_asset_manage_user_permission", {
    p_actor_id: actor.id,
    p_user_id: userId,
    p_granted: granted,
  });
  if (error) throw error;
  return data;
}
