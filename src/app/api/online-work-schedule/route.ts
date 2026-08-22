import { apiError, apiJson, requireReadActor, rpcFailure } from "@/lib/serverApi";
import { onlineWorkRepository } from "@/lib/onlineWorkRepository";
const pattern = /^\d{4}-\d{2}-\d{2}$/; const MAX_RANGE_DAYS = 42;
export async function GET(request: Request) {
  const guard = await requireReadActor(); if (!guard.ok) return guard.response;
  const params = new URL(request.url).searchParams; const from = params.get("from") ?? ""; const to = params.get("to") ?? "";
  if (!pattern.test(from) || !pattern.test(to)) return apiError("invalid_request", 400);
  const days = Math.round((new Date(`${to}T12:00:00Z`).valueOf() - new Date(`${from}T12:00:00Z`).valueOf()) / 86400000) + 1;
  if (!Number.isFinite(days) || days < 1 || days > MAX_RANGE_DAYS) return apiError("invalid_request", 400);
  const result = await onlineWorkRepository.range(from, to);
  return result.ok ? apiJson({ rows: result.rows }) : rpcFailure(result.error);
}
