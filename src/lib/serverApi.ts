import "server-only";

import { cookies, headers } from "next/headers";

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
import { mapRpcError, type RpcError } from "@/lib/rpcErrorMapping";

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
  const requestHeaders = await headers();
  const hasCookie = (await cookies()).has("thoidai_work_session");
  const hasBearer = /^Bearer\s+[^\s]+$/i.test(requestHeaders.get("authorization") ?? "");
  if ((!hasBearer || hasCookie) && !(await isSameOriginRequest())) {
    return { ok: false, response: apiError("invalid_origin", 403) };
  }
  const actor = await getSessionUser();
  return actor
    ? { ok: true, actor }
    : { ok: false, response: apiError("unauthenticated", 401) };
}

export function rpcFailure(error: RpcError): Response {
  const mapped = mapRpcError(error);
  return apiError(mapped.code, mapped.status);
}
