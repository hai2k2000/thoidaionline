import "server-only";

import { departmentManagerRepository } from "@/lib/departmentManagerRepository";
import {
  apiError,
  apiJson,
  asUuid,
  readJsonObject,
  requireMutationActor,
  rpcFailure,
} from "@/lib/serverApi";

const setManager = async (request: Request) => {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  if (
    guard.actor.role_code !== "admin" ||
    !guard.actor.permissions.can_manage_users
  ) {
    return apiError("forbidden", 403);
  }

  const body = await readJsonObject(request);
  const departmentId = asUuid(body?.departmentId);
  const managerId = asUuid(body?.managerId);
  if (!departmentId || !managerId) return apiError("invalid_request", 400);

  const result = await departmentManagerRepository.setManager(
    guard.actor.id,
    departmentId,
    managerId,
  );
  return result.error
    ? rpcFailure(result.error)
    : apiJson({ data: result.data });
};

export const departmentManagerHandlers = { setManager };
