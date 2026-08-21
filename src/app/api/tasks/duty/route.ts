import { apiError, apiJson, readJsonObject, requireMutationActor, rpcFailure } from "@/lib/serverApi";
import { dutyTaskRepository } from "@/lib/dutyTaskRepository";

const dutyPositions = new Set([
  "Biên tập và xuất bản",
  "Biên tập bước 2",
  "Biên tập bước 1",
  "Phóng viên",
]);

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  if (guard.actor.role_code !== "admin") return apiError("forbidden", 403);
  const body = await readJsonObject(request);
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (!rows.length || rows.length > 1000 || rows.length % 4 !== 0) return apiError("invalid_request", 400);
  const uniqueAssignments = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object") return apiError("invalid_request", 400);
    const input = row as Record<string, unknown>;
    const values = ["title", "description", "departmentId", "assigneeId", "reviewerId", "dueDate", "dueTime", "dutyMonth", "dutyPosition"];
    if (values.some((key) => typeof input[key] !== "string" || !(input[key] as string).trim())) return apiError("invalid_request", 400);
    if (!dutyPositions.has(input.dutyPosition as string)) return apiError("invalid_request", 400);
    if (!/^\d{4}-\d{2}$/.test(input.dutyMonth as string) || !(input.dueDate as string).startsWith(`${input.dutyMonth}-`)) return apiError("invalid_request", 400);
    const assignmentKey = `${input.dueDate}:${input.dutyPosition}`;
    if (uniqueAssignments.has(assignmentKey)) return apiError("invalid_request", 409);
    uniqueAssignments.add(assignmentKey);
  }
  const dates = new Set(rows.map((row) => (row as Record<string, unknown>).dueDate as string));
  for (const date of dates) {
    const positions = new Set(rows.filter((row) => (row as Record<string, unknown>).dueDate === date).map((row) => (row as Record<string, unknown>).dutyPosition));
    if (positions.size !== dutyPositions.size) return apiError("invalid_request", 400);
  }
  const created: string[] = [];
  for (const row of rows) {
    const result = await dutyTaskRepository.create(guard.actor.id, row as never);
    if (!result.ok) return rpcFailure(result.error);
    created.push(result.id);
  }
  return apiJson({ created }, 201);
}
