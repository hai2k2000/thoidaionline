import { apiError, apiJson, readJsonObject, requireMutationActor, requireReadActor, rpcFailure } from "@/lib/serverApi";
import { dutyTaskRepository } from "@/lib/dutyTaskRepository";

const positions = ["Xuất bản", "Biên tập", "Phóng viên"];
const positionSet = new Set(positions);
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  if (guard.actor.role_code !== "admin") return apiError("forbidden", 403);
  const params = new URL(request.url).searchParams;
  const month = params.get("month") ?? "";
  const departmentId = params.get("departmentId") ?? undefined;
  if (!monthPattern.test(month)) return apiError("invalid_request", 400);
  const result = await dutyTaskRepository.month(month, departmentId);
  return result.ok ? apiJson({ rows: result.rows }) : rpcFailure(result.error);
}

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  if (guard.actor.role_code !== "admin") return apiError("forbidden", 403);
  const body = await readJsonObject(request);
  const month = typeof body?.month === "string" ? body.month : "";
  const departmentId = typeof body?.departmentId === "string" ? body.departmentId : "";
  const reviewerId = typeof body?.reviewerId === "string" ? body.reviewerId : "";
  const days = Array.isArray(body?.days) ? body.days : null;
  if (!monthPattern.test(month) || !departmentId || !reviewerId || !days || days.length > 31) return apiError("invalid_request", 400);
  const dates = new Set<string>();
  for (const value of days) {
    if (!value || typeof value !== "object") return apiError("invalid_request", 400);
    const day = value as Record<string, unknown>;
    const date = typeof day.date === "string" ? day.date : "";
    const assignments = Array.isArray(day.assignments) ? day.assignments : [];
    if (!date.startsWith(`${month}-`) || dates.has(date) || assignments.length < 1 || assignments.length > 3) return apiError("invalid_request", 400);
    dates.add(date);
    const seen = new Set<string>();
    for (const value of assignments) {
      if (!value || typeof value !== "object") return apiError("invalid_request", 400);
      const assignment = value as Record<string, unknown>;
      const position = typeof assignment.position === "string" ? assignment.position : "";
      const assigneeId = typeof assignment.assigneeId === "string" ? assignment.assigneeId : "";
      if (!positionSet.has(position) || !assigneeId || seen.has(position)) return apiError("invalid_request", 400);
      seen.add(position);
    }
  }
  const result = await dutyTaskRepository.save(guard.actor.id, { month, departmentId, reviewerId, days: days as never });
  return result.ok ? apiJson({ summary: result.summary }) : rpcFailure(result.error);
}
