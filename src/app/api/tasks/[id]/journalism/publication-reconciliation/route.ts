import { requireMutationActor, apiError, apiJson, asUuid, readJsonObject, rpcFailure } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { taskRepository } from "@/lib/taskRepository";
import { authorizeJournalismPermission } from "@/lib/journalismAuthorization";
import { parseManualPublicationReconciliation } from "@/lib/journalismPublicationReconciliationValidation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const taskId = asUuid((await context.params).id);
  if (!taskId) return apiError("invalid_request", 400);
  const access = await taskRepository.access(taskId);
  if (!access.ok || !access.data) return apiError("not_found", 404);
  if (!await authorizeJournalismPermission(guard.actor, access.data, "journalism.publication.manage")) return apiError("forbidden", 403);
  const parsed = parseManualPublicationReconciliation(await readJsonObject(request));
  if (!parsed.ok) return apiError("invalid_request", 400);
  const { value } = parsed;
  const { data, error } = await serverSupabase.rpc("api_reconcile_journalism_publication_report_v1", {
    p_actor_id: guard.actor.id,
    p_task_id: taskId,
    p_publication_url: value.publicationUrl,
    p_published_title: value.publishedTitle,
    p_published_at: value.publishedAt,
    p_note: value.note,
    p_expected_updated_at: value.expectedUpdatedAt,
    p_reason: value.reason,
  });
  return error ? rpcFailure(error) : apiJson({ publicationReport: data });
}
