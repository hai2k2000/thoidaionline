import { apiError, apiJson, readJsonObject, requireMutationActor, requireReadActor, rpcFailure } from "@/lib/serverApi";
import { onlineWorkRepository } from "@/lib/onlineWorkRepository";
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function GET(request: Request) {
  const guard = await requireReadActor(); if (!guard.ok) return guard.response;
  if (guard.actor.role_code !== "admin") return apiError("forbidden", 403);
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!monthPattern.test(month)) return apiError("invalid_request", 400);
  const result = await onlineWorkRepository.month(month);
  return result.ok ? apiJson({ rows: result.rows }) : rpcFailure(result.error);
}
export async function POST(request: Request) {
  const guard = await requireMutationActor(); if (!guard.ok) return guard.response;
  if (guard.actor.role_code !== "admin") return apiError("forbidden", 403);
  const body = await readJsonObject(request); const month = typeof body?.month === "string" ? body.month : "";
  const days = Array.isArray(body?.days) ? body.days : null;
  if (!monthPattern.test(month) || !days || days.length > 31) return apiError("invalid_request", 400);
  const seen = new Set<string>(); const normalized: { date: string; staffIds: string[] }[] = [];
  for (const value of days) {
    if (!value || typeof value !== "object") return apiError("invalid_request", 400);
    const row = value as Record<string, unknown>; const date = typeof row.date === "string" ? row.date : "";
    const staffIds = Array.isArray(row.staffIds) && row.staffIds.every(id => typeof id === "string") ? row.staffIds as string[] : [];
    if (!date.startsWith(`${month}-`) || staffIds.length < 1 || staffIds.length > 6 || seen.has(date)) return apiError("invalid_request", 400);
    if (staffIds.some(id => !uuidPattern.test(id)) || new Set(staffIds).size !== staffIds.length) return apiError("invalid_request", 400);
    seen.add(date); normalized.push({ date, staffIds });
  }
  const result = await onlineWorkRepository.save(guard.actor.id, month, normalized);
  return result.ok ? apiJson({ summary: result.summary }) : rpcFailure(result.error);
}
