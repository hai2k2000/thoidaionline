import { requireMutationActor, apiError, apiJson, asUuid, readJsonObject, rpcFailure } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { canAssignToDepartment } from "@/lib/authorization";
import { canUseJournalism } from "@/lib/journalismScope.mjs";

const text = (value: unknown, max: number) => typeof value === "string" && [...value.trim()].length <= max ? value.trim() : null;
const date = (value: unknown) => typeof value === "string" && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : null;

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = await readJsonObject(request);
  const allowedFields = new Set([
    "title", "description", "departmentId", "assigneeId", "dueDate", "dueTime",
    "evaluationCriteria", "priority", "collaboratorIds", "watcherIds", "recurrenceFrequency",
    "recurrenceEndsOn", "journalism",
  ]);
  if (body && Object.keys(body).some((key) => !allowedFields.has(key))) {
    return apiError("invalid_request", 400);
  }
  const journalism = body?.journalism && typeof body.journalism === "object" && !Array.isArray(body.journalism)
    ? body.journalism as Record<string, unknown> : null;
  const allowedJournalismFields = new Set(["workKindId", "plannedPublicationAt", "location", "editorialNotes"]);
  if (journalism && Object.keys(journalism).some((key) => !allowedJournalismFields.has(key))) {
    return apiError("invalid_request", 400);
  }
  const departmentId = asUuid(body?.departmentId);
  const assigneeId = asUuid(body?.assigneeId);
  const reviewerId = guard.actor.id;
  const workKindId = asUuid(journalism?.workKindId);
  const title = text(body?.title, 500);
  const description = text(body?.description, 10000);
  const dueDate = typeof body?.dueDate === "string" ? body.dueDate : null;
  const dueTime = typeof body?.dueTime === "string" ? body.dueTime : null;
  const plannedPublicationAt = journalism?.plannedPublicationAt;
  const hasInvalidPlannedPublicationAt = plannedPublicationAt !== undefined
    && plannedPublicationAt !== null
    && plannedPublicationAt !== ""
    && date(plannedPublicationAt) === null;
  const hasRecurrence = (body?.recurrenceFrequency !== undefined && body?.recurrenceFrequency !== null && body?.recurrenceFrequency !== "")
    || (body?.recurrenceEndsOn !== undefined && body?.recurrenceEndsOn !== null && body?.recurrenceEndsOn !== "");
  if (!body || !journalism || !departmentId || !assigneeId || !reviewerId || !workKindId || !title || !description || !dueDate || !dueTime || hasRecurrence || hasInvalidPlannedPublicationAt) {
    return apiError("invalid_request", 400);
  }
  if (!canUseJournalism({ roleCode: guard.actor.role_code, departmentCode: guard.actor.department_code, rbacPermissions: guard.actor.rbacPermissions })) return apiError("forbidden", 403);
  const actor = { id: guard.actor.id, departmentId: guard.actor.department_id, roleCode: guard.actor.role_code, roleLevel: guard.actor.role_level, permissions: guard.actor.permissions };
  if (!guard.actor.permissions.can_create_task || !canAssignToDepartment(actor, departmentId)) return apiError("forbidden", 403);
  const collaboratorIds = Array.isArray(body.collaboratorIds) ? body.collaboratorIds.map(asUuid).filter(Boolean) : [];
  const watcherIds = Array.isArray(body.watcherIds) ? body.watcherIds.map(asUuid).filter(Boolean) : [];
  const { data, error } = await serverSupabase.rpc("api_assign_journalism_task_v1", {
    p_actor_id: guard.actor.id, p_title: title, p_description: description, p_department_id: departmentId,
    p_assignee_id: assigneeId, p_reviewer_id: reviewerId, p_due_date: dueDate, p_due_time: dueTime,
    p_evaluation_criteria: typeof body.evaluationCriteria === "string" ? body.evaluationCriteria : null,
    p_priority: typeof body.priority === "string" ? body.priority : "normal",
    p_collaborator_ids: collaboratorIds, p_watcher_ids: watcherIds, p_work_kind_id: workKindId,
    p_planned_publication_at: date(journalism.plannedPublicationAt), p_location: text(journalism.location, 500),
    p_editorial_notes: text(journalism.editorialNotes, 10000),
  });
  return error ? rpcFailure(error) : apiJson({ task: data }, 201);
}
