import { serverSupabase } from "@/lib/serverSupabase";
import { hasPermission } from "@/lib/rbac/authorization";
import {
  loadRbacActor,
  loadEffectivePermissionCatalog,
  replaceRolePermissions,
  restoreUserPermissionInheritance,
  clearUserPermissionOverride,
  setAssetManageUserPermission,
  setQuickReportUserPermission,
  setUserPermissionOverride,
} from "@/lib/rbac/repository";
import {
  buildPermissionUsers,
  buildQuickReportUserPermissions,
  buildPermissionManagementPayload,
  type PermissionMatrixGrantRow,
  type PermissionMatrixPermissionRow,
  type PermissionMatrixRoleRow,
  type PermissionMatrixUserRow,
  type UserPermissionGrantRow,
} from "@/lib/permissionMatrix";
import { isCatalogPermission, supportedScopesForPermission } from "@/lib/rbac/permissionCatalog";
import { apiError, apiJson, asUuid, readJsonObject, requireMutationActor, requireReadActor, rpcFailure } from "@/lib/serverApi";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Legacy clients are limited to the two existing catalog mutations:
// permissionCode !== "task.quick_report.create" && permissionCode !== "asset.manage" is rejected.

export async function GET() {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  try {
    const actor = await loadRbacActor(guard.actor);
    if (!hasPermission(actor, "permission.manage")) return apiError("forbidden", 403);
  } catch (error) {
    return rpcFailure(error as { code?: string | null });
  }
  const [rolesResult, permissionsResult, grantsResult, usersResult, userGrantsResult] = await Promise.all([
    serverSupabase.from("roles").select("id,code,name,level,active").order("level", { ascending: false }).order("name"),
    serverSupabase.from("permissions").select("id,code,name,module,description").order("module").order("code"),
    serverSupabase.from("role_permission_grants").select("role_id,permission_id,scope").order("role_id").order("permission_id").order("scope"),
    serverSupabase.from("staff_users").select("id,username,full_name,active,role_id,roles(code,name,active),departments!staff_users_department_id_fkey(id,name),job_titles!staff_users_job_title_id_fkey(name)").order("full_name"),
    serverSupabase.from("user_permission_grants").select("user_id,permission_id,effect,scope").order("user_id").order("permission_id"),
  ]);
  const error = rolesResult.error ?? permissionsResult.error ?? grantsResult.error ?? usersResult.error ?? userGrantsResult.error;
  if (error) return rpcFailure(error);
  const permissions = (permissionsResult.data ?? []) as PermissionMatrixPermissionRow[];
  const roleGrants = (grantsResult.data ?? []) as PermissionMatrixGrantRow[];
  const userGrants = (userGrantsResult.data ?? []) as UserPermissionGrantRow[];
  const payload = buildPermissionManagementPayload({
    roles: (rolesResult.data ?? []) as PermissionMatrixRoleRow[],
    permissions,
    roleGrants,
    users: ((usersResult.data ?? []) as unknown as Array<PermissionMatrixUserRow & { departments?: { id?: string; name: string } | { id?: string; name: string }[] | null; job_titles?: { name: string } | { name: string }[] | null }>).map((entry) => {
      const department = Array.isArray(entry.departments) ? entry.departments[0] : entry.departments;
      const jobTitle = Array.isArray(entry.job_titles) ? entry.job_titles[0] : entry.job_titles;
      return { ...entry, department_id: department?.id ?? null, department_name: department?.name ?? null, job_title: jobTitle?.name ?? null };
    }),
    userGrants,
  });
  return apiJson({
    ...payload,
    roleCatalog: payload.roles,
    effectiveCatalog: await loadEffectivePermissionCatalog(guard.actor),
    users: payload.users.map((user) => ({
      ...user,
      username: user.username,
      department_id: (user as PermissionMatrixUserRow & { department_id?: string | null }).department_id ?? null,
      department_name: user.department_name ?? null,
      job_title: (user as PermissionMatrixUserRow & { job_title?: string | null }).job_title ?? null,
      role_code: (Array.isArray(user.roles) ? user.roles[0] : user.roles)?.code ?? null,
      override_count: Object.keys(user.overrides).length,
    })),
    assetUsers: buildPermissionUsers((usersResult.data ?? []) as PermissionMatrixUserRow[], permissions, roleGrants, userGrants, "asset.manage"),
    quickReportUsers: buildQuickReportUserPermissions((usersResult.data ?? []) as PermissionMatrixUserRow[], permissions, roleGrants, userGrants),
  });
}

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = await readJsonObject(request);
  const roleId = asUuid(body?.roleId);
  const userId = asUuid(body?.userId);
  const action = body?.action;
  const permissionCode = typeof body?.permissionCode === "string" ? body.permissionCode : null;
  try {
    const actor = await loadRbacActor(guard.actor);
    if (!hasPermission(actor, "permission.manage")) return apiError("forbidden", 403);
    if (body?.action === "replace_role_permissions") {
      if (!roleId || !Array.isArray(body.grants)) return apiError("invalid_request", 400);
      const rawGrants = body.grants;
      const grants = rawGrants.filter((grant): grant is { permissionCode: string; scopes: string[] } => Boolean(grant) && typeof grant === "object" && typeof (grant as { permissionCode?: unknown }).permissionCode === "string" && Array.isArray((grant as { scopes?: unknown }).scopes));
      if (grants.length !== rawGrants.length || grants.some((grant) => !isCatalogPermission(grant.permissionCode) || grant.scopes.some((scope) => !supportedScopesForPermission(grant.permissionCode).includes(scope as never)))) return apiError("invalid_request", 400);
      return apiJson({ result: await replaceRolePermissions(actor, roleId, grants) });
    }
    if (body?.action === "set_user_override") {
      const effect = body.effect;
      const scope = body.scope;
      if (!userId || !permissionCode || !isCatalogPermission(permissionCode) || (effect !== "allow" && effect !== "deny") || typeof scope !== "string" || !supportedScopesForPermission(permissionCode).includes(scope as never)) return apiError("invalid_request", 400);
      return apiJson({ result: await setUserPermissionOverride(actor, userId, permissionCode, effect, scope as "self" | "assigned" | "department" | "all") });
    }
    if (body?.action === "restore_user_inheritance") {
      if (!userId) return apiError("invalid_request", 400);
      return apiJson({ result: await restoreUserPermissionInheritance(actor, userId) });
    }
    if (body?.action === "clear_user_override") {
      if (!userId || !permissionCode || !isCatalogPermission(permissionCode)) return apiError("invalid_request", 400);
      return apiJson({ result: await clearUserPermissionOverride(actor, userId, permissionCode) });
    }
    if (body?.action === "replace_department_view_grants") {
      if (!userId || !Array.isArray(body.departmentIds) || body.departmentIds.some((id: unknown) => !asUuid(id))) return apiError("invalid_request", 400);
      const ids = [...new Set(body.departmentIds as string[])];
      const { error: deleteError } = await serverSupabase.from("db_department_view_grants").delete().eq("user_id", userId);
      if (deleteError) return rpcFailure(deleteError);
      if (ids.length) {
        const { error: insertError } = await serverSupabase.from("db_department_view_grants").insert(ids.map((departmentId) => ({ user_id: userId, department_id: departmentId, granted_by: guard.actor.id })));
        if (insertError) return rpcFailure(insertError);
      }
      return apiJson({ result: { userId, departmentIds: ids } });
    }
    if ((!roleId && !userId) || (roleId && userId) || (action !== "grant" && action !== "revoke") || (permissionCode !== "task.quick_report.create" && permissionCode !== "asset.manage")) return apiError("invalid_request", 400);
    if (userId) {
      const data = permissionCode === "asset.manage"
        ? await setAssetManageUserPermission(actor, userId, action === "grant")
        : await setQuickReportUserPermission(actor, userId, action === "grant");
      return apiJson({ result: data });
    }
    const { data, error } = await serverSupabase.rpc(permissionCode === "asset.manage" ? "api_set_asset_manage_permission" : "api_set_quick_report_permission", {
      p_actor_id: guard.actor.id,
      p_role_id: roleId,
      p_granted: action === "grant",
    });
    if (error) return rpcFailure(error);
    return apiJson({ result: data });
  } catch (error) {
    return rpcFailure(error as { code?: string | null });
  }
}

export async function PUT(request: Request) { return POST(request); }
export async function PATCH(request: Request) { return POST(request); }
export async function DELETE(request: Request) {
  const body = await readJsonObject(request);
  return POST(new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify({ ...body, action: "revoke" }) }));
}
