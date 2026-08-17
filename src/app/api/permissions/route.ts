import { serverSupabase } from "@/lib/serverSupabase";
import { PERMISSION_KEYS, type PermissionSet } from "@/lib/permissions";
import {
  apiError,
  apiJson,
  readJsonObject,
  requireMutationActor,
  requireReadActor,
  rpcFailure,
} from "@/lib/serverApi";
import { logServerAudit } from "@/lib/serverAudit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PermissionRow = PermissionSet & {
  role_id: string;
  roles: {
    id: string;
    code: string;
    name: string;
    level: number;
  } | null;
};

const PHASE_ONE_PERMISSION_KEYS = [
  "can_assign_task",
  "can_view_department_tasks",
  "can_evaluate_step1",
  "can_evaluate_step2",
  "can_manage_rubrics",
] as const satisfies readonly (typeof PERMISSION_KEYS)[number][];

const SELECT_FIELDS = [
  "role_id",
  ...PERMISSION_KEYS,
  "roles(id,code,name,level)",
].join(",");

export async function GET() {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  if (guard.actor.role_code !== "admin") {
    return apiError("forbidden", 403);
  }
  const { data, error } = await serverSupabase
    .from("role_permissions")
    .select(SELECT_FIELDS)
    .order("role_id");
  if (error) return rpcFailure(error);
  return apiJson({
    permissions: (data ?? []) as unknown as PermissionRow[],
    can_rename: true,
  });
}

const text = (value: unknown) => typeof value === "string"
  ? value.normalize("NFC").trim().replace(/\s+/gu, " ")
  : "";

export async function PATCH(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  if (guard.actor.role_code !== "admin") {
    return apiError("forbidden", 403);
  }

  const body = await readJsonObject(request);
  const roleId = text(body?.role_id);
  const name = text(body?.name);
  if (!roleId) return apiError("invalid_request", 400);

  const permission = typeof body?.permission === "string"
    ? body.permission
    : "";
  if (permission) {
    if (
      name
      || !PERMISSION_KEYS.includes(
        permission as (typeof PERMISSION_KEYS)[number],
      )
      || typeof body?.value !== "boolean"
    ) {
      return apiError("invalid_request", 400);
    }
    const { data: current, error: currentError } = await serverSupabase
      .from("role_permissions")
      .select(`role_id,${permission}`)
      .eq("role_id", roleId)
      .maybeSingle();
    if (currentError) return rpcFailure(currentError);
    if (!current) return apiError("not_found", 404);

    const value = body.value;
    const { error } = await serverSupabase
      .from("role_permissions")
      .update({ [permission]: value, updated_at: new Date().toISOString() })
      .eq("role_id", roleId);
    if (error) return rpcFailure(error);

    await logServerAudit({
      actorId: guard.actor.id,
      module: "admin",
      entityType: "role_permissions",
      entityId: roleId,
      action: "update",
      oldData: {
        [permission]:
          (current as unknown as Record<string, unknown>)[permission],
      },
      newData: { [permission]: value },
    });
    return apiJson({
      permission: { role_id: roleId, field: permission, value },
    });
  }

  const nameLength = [...name].length;
  if (nameLength < 2 || nameLength > 120) {
    return apiError("invalid_request", 400);
  }
  const { data: before, error: beforeError } = await serverSupabase
    .from("roles")
    .select("id,code,name,level")
    .eq("id", roleId)
    .maybeSingle();
  if (beforeError) return rpcFailure(beforeError);
  if (!before) return apiError("not_found", 404);

  const { data, error } = await serverSupabase
    .from("roles")
    .update({ name })
    .eq("id", roleId)
    .select("id,code,name,level")
    .maybeSingle();
  if (error) return rpcFailure(error);
  if (!data) return apiError("not_found", 404);

  await logServerAudit({
    actorId: guard.actor.id,
    module: "admin",
    entityType: "role",
    entityId: data.id,
    action: "update",
    oldData: { name: before.name },
    newData: { name: data.name },
  });
  return apiJson({ role: data });
}
