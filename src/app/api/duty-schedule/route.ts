import {
  apiError,
  apiJson,
  requireReadActor,
  rpcFailure,
} from "@/lib/serverApi";
import { dutyTaskRepository } from "@/lib/dutyTaskRepository";
const MAX_RANGE_DAYS = 42;
const pattern = /^\d{4}-\d{2}-\d{2}$/;
export async function GET(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const mine = params.get("mine") === "1";
  if (!pattern.test(from) || !pattern.test(to))
    return apiError("invalid_request", 400);
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  const days = Math.round((end.valueOf() - start.valueOf()) / 86400000) + 1;
  if (!Number.isFinite(days) || days < 1 || days > MAX_RANGE_DAYS)
    return apiError("invalid_request", 400);
  const result = await dutyTaskRepository.schedule(from, to, mine ? guard.actor.id : undefined);
  return result.ok ? apiJson({ rows: result.rows }) : rpcFailure(result.error);
}
