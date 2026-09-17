import { serverSupabase } from "@/lib/serverSupabase";
import { hasPermission } from "@/lib/rbac/authorization";
import { loadRbacActor } from "@/lib/rbac/repository";
import {
  buildPermissionMatrix,
  type PermissionMatrixGrantRow,
  type PermissionMatrixPermissionRow,
  type PermissionMatrixRoleRow,
} from "@/lib/permissionMatrix";
import { apiError, apiJson, requireReadActor, rpcFailure } from "@/lib/serverApi";

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
  const [rolesResult, permissionsResult, grantsResult] = await Promise.all([
    serverSupabase.from("roles").select("id,code,name,level,active").order("level", { ascending: false }).order("name"),
    serverSupabase.from("permissions").select("id,code,name,module,description").order("module").order("code"),
    serverSupabase.from("role_permission_grants").select("role_id,permission_id,scope").order("role_id").order("permission_id").order("scope"),
  ]);
  const error = rolesResult.error ?? permissionsResult.error ?? grantsResult.error;
  if (error) return rpcFailure(error);
  return apiJson({ roles: buildPermissionMatrix(
    (rolesResult.data ?? []) as PermissionMatrixRoleRow[],
    (permissionsResult.data ?? []) as PermissionMatrixPermissionRow[],
    (grantsResult.data ?? []) as PermissionMatrixGrantRow[],
  ) });
}

export async function POST() { return apiJson({ error: { code: "read_only" } }, 405); }
export async function PUT() { return apiJson({ error: { code: "read_only" } }, 405); }
export async function PATCH() { return apiJson({ error: { code: "read_only" } }, 405); }
export async function DELETE() { return apiJson({ error: { code: "read_only" } }, 405); }
