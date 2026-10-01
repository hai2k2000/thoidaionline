import { serverSupabase } from "@/lib/serverSupabase";
import { hasPermission } from "@/lib/rbac/authorization";
import { loadRbacActor, setQuickReportUserPermission } from "@/lib/rbac/repository";
import {
  buildPermissionMatrix,
  buildQuickReportUserPermissions,
  type PermissionMatrixGrantRow,
  type PermissionMatrixPermissionRow,
  type PermissionMatrixRoleRow,
  type PermissionMatrixUserRow,
  type UserPermissionGrantRow,
} from "@/lib/permissionMatrix";
import { apiError, apiJson, asUuid, readJsonObject, requireMutationActor, requireReadActor, rpcFailure } from "@/lib/serverApi";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    serverSupabase.from("staff_users").select("id,username,full_name,active,role_id,roles(code,name)").order("full_name"),
    serverSupabase.from("user_permission_grants").select("user_id,permission_id").order("user_id").order("permission_id"),
  ]);
  const error = rolesResult.error ?? permissionsResult.error ?? grantsResult.error ?? usersResult.error ?? userGrantsResult.error;
  if (error) return rpcFailure(error);
  const permissions = (permissionsResult.data ?? []) as PermissionMatrixPermissionRow[];
  const roleGrants = (grantsResult.data ?? []) as PermissionMatrixGrantRow[];
  return apiJson({
    roles: buildPermissionMatrix(
      (rolesResult.data ?? []) as PermissionMatrixRoleRow[],
      permissions,
      roleGrants,
    ),
    users: buildQuickReportUserPermissions(
      (usersResult.data ?? []) as PermissionMatrixUserRow[],
      permissions,
      roleGrants,
      (userGrantsResult.data ?? []) as UserPermissionGrantRow[],
    ),
  });
}

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = await readJsonObject(request);
  const roleId = asUuid(body?.roleId);
  const userId = asUuid(body?.userId);
  const action = body?.action;
  if ((!roleId && !userId) || (roleId && userId) || (action !== "grant" && action !== "revoke")) return apiError("invalid_request", 400);
  try {
    const actor = await loadRbacActor(guard.actor);
    if (!hasPermission(actor, "permission.manage")) return apiError("forbidden", 403);
    if (userId) {
      const data = await setQuickReportUserPermission(actor, userId, action === "grant");
      return apiJson({ result: data });
    }
    const { data, error } = await serverSupabase.rpc("api_set_quick_report_permission", {
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
