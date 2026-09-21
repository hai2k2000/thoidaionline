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
    active: boolean;
  } | null;
};

const PHASE_ONE_PERMISSION_KEYS = [
  "can_assign_task",
  "can_view_department_tasks",
  "can_evaluate_step1",
  "can_evaluate_step2",
  "can_manage_rubrics",
] as const satisfies readonly (typeof PERMISSION_KEYS)[number][];
const ROLE_LIFECYCLE_ENABLED = process.env.ROLE_LIFECYCLE_ENABLED === "true";

const SELECT_FIELDS = [
  "role_id",
  ...PERMISSION_KEYS,
  `roles!inner(id,code,name,level${ROLE_LIFECYCLE_ENABLED ? ",active" : ""})`,
].join(",");

export async function GET(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  if (guard.actor.role_code !== "admin") {
    return apiError("forbidden", 403);
  }
  const status = new URL(request.url).searchParams.get("status") ?? "active";
  if (!["active", "locked", "all"].includes(status)) return apiError("invalid_request", 400);
  let query = serverSupabase
    .from("role_permissions")
    .select(SELECT_FIELDS)
    .order("role_id");
  if (ROLE_LIFECYCLE_ENABLED && status !== "all") query = query.eq("roles.active", status === "active");
  const { data, error } = await query;
  if (error) return rpcFailure(error);
  return apiJson({
    permissions: ((data ?? []) as unknown as PermissionRow[]).map((row) => ({ ...row, roles: row.roles ? { ...row.roles, active: row.roles.active ?? true } : null })),
    can_rename: true,
    can_manage_roles: true,
  });
}

const text = (value: unknown) => typeof value === "string"
  ? value.normalize("NFC").trim().replace(/\s+/gu, " ")
  : "";

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  if (guard.actor.role_code !== "admin") return apiError("forbidden", 403);
  if (!ROLE_LIFECYCLE_ENABLED) return apiError("operation_failed", 503);
  const body = await readJsonObject(request);
  const code = text(body?.code).toLowerCase();
  const name = text(body?.name);
  const level = typeof body?.level === "number" ? body.level : Number.NaN;
  if (!/^[a-z][a-z0-9_]{2,49}$/.test(code) || [...name].length < 2 || [...name].length > 120 || !Number.isInteger(level) || level < 1 || level > 99) return apiError("invalid_request", 400);
  const result = await serverSupabase.rpc("api_create_role", { p_actor: guard.actor.id, p_code: code, p_name: name, p_level: level });
  if (result.error?.code === "23505") return apiError("conflict", 409);
  if (result.error) return rpcFailure(result.error);
  const role = result.data as { id: string; code: string; name: string; level: number; active: boolean };
  await logServerAudit({ actorId: guard.actor.id, module: "admin", entityType: "role", entityId: role.id, action: "create", newData: { code: role.code, name: role.name, level: role.level, active: role.active } });
  return apiJson({ role }, 201);
}

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
  if (typeof body?.active === "boolean") {
    if (!ROLE_LIFECYCLE_ENABLED) return apiError("operation_failed", 503);
    if (permission || name) return apiError("invalid_request", 400);
    const before = await serverSupabase.from("roles").select("id,code,name,level,active").eq("id", roleId).maybeSingle();
    if (before.error) return rpcFailure(before.error);
    if (!before.data) return apiError("not_found", 404);
    if (before.data.code === "admin" && body.active === false) return apiError("forbidden", 403);
    const result = await serverSupabase.rpc("api_set_role_active", { p_actor: guard.actor.id, p_role: roleId, p_active: body.active });
    if (result.error) return rpcFailure(result.error);
    const role = result.data as { id: string; code: string; name: string; level: number; active: boolean };
    await logServerAudit({ actorId: guard.actor.id, module: "admin", entityType: "role", entityId: role.id, action: role.active ? "unlock" : "lock", oldData: { active: before.data.active }, newData: { active: role.active } });
    return apiJson({ role });
  }
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
