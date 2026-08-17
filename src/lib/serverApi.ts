import "server-only";

import {
  apiError,
  apiJson,
  type ApiErrorCode,
} from "@/lib/apiResponse";
import {
  getSessionUser,
  isSameOriginRequest,
  type ServerAuthUser,
} from "@/lib/serverSession";

export { apiError, apiJson, type ApiErrorCode };

export type ActorGuard =
  | { ok: true; actor: ServerAuthUser }
  | { ok: false; response: Response };

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function asUuid(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value)
    ? value
    : null;
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | null> {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : null;
}

export async function requireReadActor(): Promise<ActorGuard> {
  const actor = await getSessionUser();
  return actor
    ? { ok: true, actor }
    : { ok: false, response: apiError("unauthenticated", 401) };
}

export async function requireMutationActor(): Promise<ActorGuard> {
  if (!(await isSameOriginRequest())) {
    return { ok: false, response: apiError("invalid_origin", 403) };
  }
  const actor = await getSessionUser();
  return actor
    ? { ok: true, actor }
    : { ok: false, response: apiError("unauthenticated", 401) };
}

export function rpcFailure(error: { code?: string | null }): Response {
  switch (error.code) {
    case "42501":
      return apiError("forbidden", 403);
    case "P0002":
      return apiError("not_found", 404);
    case "22023":
    case "22007":
    case "23514":
      return apiError("invalid_request", 400);
    case "23505":
    case "40001":
      return apiError("conflict", 409);
    default:
      return apiError("operation_failed", 500);
  }
}
