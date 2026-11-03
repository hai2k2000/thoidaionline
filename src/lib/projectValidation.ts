import { asUuid } from "@/lib/serverApi";
import type { ProjectAssignmentInput } from "@/lib/projectRepository";
export function projectIds(value: unknown): string[] | null {
  return Array.isArray(value) && value.length <= 500 && value.every((id) => asUuid(id)) ? [...new Set(value as string[])] : null;
}
export function parseProject(body: Record<string, unknown> | null) {
  if (!body || typeof body.code !== "string" || !body.code.trim() || body.code.length > 100 || typeof body.name !== "string" || !body.name.trim() || body.name.length > 250 || !asUuid(body.hostDepartmentId) || (body.description != null && (typeof body.description !== "string" || body.description.length > 10000))) return null;
  return { code: body.code.trim(), name: body.name.trim(), description: body.description as string | null | undefined, hostDepartmentId: body.hostDepartmentId as string };
}
export function parseProjectAssignment(body: Record<string, unknown> | null): ProjectAssignmentInput | null {
  if (!body || typeof body.title !== "string" || !body.title.trim() || body.title.length > 500 || typeof body.description !== "string" || body.description.length > 10000 || !asUuid(body.assigneeId) || (body.reviewerId != null && !asUuid(body.reviewerId))) return null;
  if (typeof body.dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) || !Number.isFinite(Date.parse(body.dueDate)) || new Date(body.dueDate).toISOString().slice(0,10) !== body.dueDate || typeof body.dueTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.dueTime)) return null;
  const collaboratorIds = projectIds(body.collaboratorIds ?? []); const watcherIds = projectIds(body.watcherIds ?? []);
  if (!collaboratorIds || !watcherIds || !["low","normal","high","urgent"].includes(String(body.priority ?? "normal"))) return null;
  if (body.recurrenceFrequency || body.groupDepartmentId || body.tasks || body.cards) return null;
  if (!Array.isArray(body.requirements) || body.requirements.length > 100 || !body.requirements.every((item) => typeof item === "string" && item.length <= 2000)) return null;
  const requirements = body.requirements.map((item: string) => item.trim()).filter(Boolean);
  const evaluationCriteria = JSON.stringify(requirements);
  const description = body.description.trim() || requirements.map((item) => `- ${item}`).join("\n");
  if (!description || description.length > 10000 || evaluationCriteria.length > 10000) return null;
  return { title: body.title.trim(), description, assigneeId: body.assigneeId as string, reviewerId: body.reviewerId as string | null | undefined, dueDate: body.dueDate, dueTime: body.dueTime, evaluationCriteria, collaboratorIds, watcherIds, priority: (body.priority ?? "normal") as ProjectAssignmentInput["priority"] };
}
