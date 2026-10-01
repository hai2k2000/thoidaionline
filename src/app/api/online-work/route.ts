import { apiError, apiJson, readJsonObject, requireMutationActor, requireReadActor, rpcFailure } from "@/lib/serverApi";
import { onlineWorkRepository } from "@/lib/onlineWorkRepository";
import { readOnlineWorkWorkbook, resolveOnlineWorkImport } from "@/lib/onlineWorkExcel.mjs";
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isValidDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};
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
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx") || file.size < 1 || file.size > 5 * 1024 * 1024) {
        return apiError("invalid_request", 400);
      }
      const parsed = await readOnlineWorkWorkbook(Buffer.from(await file.arrayBuffer()));
      const people = await onlineWorkRepository.reporters();
      if (!people.ok) return apiError("service_unavailable", 503);
      const resolved = resolveOnlineWorkImport(parsed, people.people);
      if (resolved.errors.length) return apiJson({ error: { code: "invalid_request", message: "Không đối chiếu được đầy đủ tổ ngoại ngữ.", details: resolved.errors }, month: parsed.month }, 400);
      if (form.get("mode") !== "confirm") return apiJson({ mode: "preview", month: parsed.month, days: resolved.days, totalDays: resolved.days.length });
      const saved = await onlineWorkRepository.save(guard.actor.id, parsed.month, resolved.days);
      return saved.ok ? apiJson({ mode: "confirm", month: parsed.month, imported: resolved.days.length, summary: saved.summary }) : rpcFailure(saved.error);
    } catch (error) {
      return apiJson({ error: { code: "invalid_request", message: error instanceof Error ? error.message : "Không đọc được file Excel." } }, 400);
    }
  }
  const body = await readJsonObject(request); const month = typeof body?.month === "string" ? body.month : "";
  const days = Array.isArray(body?.days) ? body.days : null;
  if (!monthPattern.test(month) || !days || days.length > 31) return apiError("invalid_request", 400);
  const seen = new Set<string>(); const normalized: { date: string; staffIds: string[] }[] = [];
  for (const value of days) {
    if (!value || typeof value !== "object") return apiError("invalid_request", 400);
    const row = value as Record<string, unknown>; const date = typeof row.date === "string" ? row.date : "";
    const staffIds = Array.isArray(row.staffIds) && row.staffIds.every(id => typeof id === "string") ? row.staffIds as string[] : [];
    if (!isValidDate(date) || !date.startsWith(`${month}-`) || staffIds.length < 1 || staffIds.length > 6 || seen.has(date)) return apiError("invalid_request", 400);
    if (staffIds.some(id => !uuidPattern.test(id)) || new Set(staffIds).size !== staffIds.length) return apiError("invalid_request", 400);
    seen.add(date); normalized.push({ date, staffIds });
  }
  const result = await onlineWorkRepository.save(guard.actor.id, month, normalized);
  return result.ok ? apiJson({ summary: result.summary }) : rpcFailure(result.error);
}
