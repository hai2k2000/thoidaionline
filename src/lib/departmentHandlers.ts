import "server-only";

import { departmentRepository, type DepartmentRow } from "@/lib/departmentRepository";
import {
  apiError,
  apiJson,
  asUuid,
  readJsonObject,
  requireMutationActor,
  requireReadActor,
} from "@/lib/serverApi";

const DEPARTMENT_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isAdmin = (actor: { role_code: string; permissions: { can_manage_users: boolean } }) =>
  actor.role_code === "admin" && actor.permissions.can_manage_users;

const repositoryFailure = (error: { code?: string | null } | null) => {
  if (error?.code === "23505") return apiError("conflict", 409);
  return apiError("operation_failed", 500);
};

const list = async () => {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const actor = guard.actor;
  if (actor.role_code !== "admin" || !actor.permissions.can_manage_users) {
    return apiError("forbidden", 403);
  }
  const result = await departmentRepository.list();
  return result.error
    ? repositoryFailure(result.error)
    : apiJson({ departments: (result.data ?? []) as DepartmentRow[] });
};

const create = async (request: Request) => {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const actor = guard.actor;
  if (actor.role_code !== "admin" || !actor.permissions.can_manage_users) {
    return apiError("forbidden", 403);
  }
  const body = await readJsonObject(request);
  const code = typeof body?.code === "string" ? body.code.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (
    code.length > 50 ||
    !DEPARTMENT_CODE_PATTERN.test(code) ||
    name.length < 2 ||
    name.length > 120
  ) {
    return apiError("invalid_request", 400);
  }
  const result = await departmentRepository.create(code, name);
  return result.error
    ? repositoryFailure(result.error)
    : apiJson({ department: result.data }, 201);
};

const update = async (request: Request) => {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  if (!isAdmin(guard.actor)) return apiError("forbidden", 403);
  const body = await readJsonObject(request);
  const id = asUuid(body?.id);
  if (!id) return apiError("invalid_request", 400);

  const patch: { name?: string; active?: boolean } = {};
  if (Object.prototype.hasOwnProperty.call(body ?? {}, "name")) {
    if (typeof body?.name !== "string") return apiError("invalid_request", 400);
    const name = body.name.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 120) return apiError("invalid_request", 400);
    patch.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(body ?? {}, "active")) {
    if (typeof body?.active !== "boolean") return apiError("invalid_request", 400);
    patch.active = body.active;
  }
  if (!Object.keys(patch).length) return apiError("invalid_request", 400);

  const result = await departmentRepository.update(id, patch);
  if (result.error) return repositoryFailure(result.error);
  if (!result.data) return apiError("not_found", 404);
  return apiJson({ department: result.data });
};

export const departmentHandlers = { list, create, update };
