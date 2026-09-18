import { requireMutationActor, apiError, apiJson, asUuid, readJsonObject, rpcFailure } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { taskRepository } from "@/lib/taskRepository";
import { authorizeJournalismPermission } from "@/lib/journalismAuthorization";
import { boundedText, asIsoDate, validateMetadataPatch } from "@/lib/journalismMutationValidation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const taskId = asUuid((await context.params).id);
  const body = await readJsonObject(request);
  if (!taskId || !body) return apiError("invalid_request", 400);
  const access = await taskRepository.access(taskId);
  if (!access.ok || !access.data) return apiError("not_found", 404);
  if (!await authorizeJournalismPermission(guard.actor, access.data, "journalism.metadata.update")) return apiError("forbidden", 403);
  const allowed = new Set(["workKindId", "plannedPublicationAt", "location", "editorialNotes"]);
  if (Object.keys(body).some((key) => !allowed.has(key))) return apiError("invalid_request", 400);
  const detail = await serverSupabase.from("journalism_task_details").select("publication_status,work_kind_id,planned_publication_at,location,editorial_notes").eq("task_id", taskId).maybeSingle();
  if (detail.error || !detail.data) return apiError("not_found", 404);
  const validation = validateMetadataPatch(detail.data.publication_status, body);
  if (!validation.ok) return apiError("invalid_request", 400);
  const kind = body.workKindId === undefined ? detail.data.work_kind_id : asUuid(body.workKindId);
  const planned = body.plannedPublicationAt === undefined ? detail.data.planned_publication_at : asIsoDate(body.plannedPublicationAt);
  const location = body.location === undefined ? detail.data.location : boundedText(body.location, 500);
  const notes = body.editorialNotes === undefined ? detail.data.editorial_notes : boundedText(body.editorialNotes, 10000);
  if (body.workKindId !== undefined && !kind || planned === undefined || location === undefined || notes === undefined) return apiError("invalid_request", 400);
  const { data, error } = await serverSupabase.rpc("api_update_journalism_metadata_v1", {
    p_actor_id: guard.actor.id, p_task_id: taskId, p_work_kind_id: kind,
    p_planned_publication_at: planned, p_location: location, p_editorial_notes: notes,
    p_expected_updated_at: null,
  });
  return error ? rpcFailure(error) : apiJson({ journalism: data });
}
