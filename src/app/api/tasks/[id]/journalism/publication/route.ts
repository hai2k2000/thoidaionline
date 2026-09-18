import { requireMutationActor, apiError, apiJson, asUuid, readJsonObject, rpcFailure } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { taskRepository } from "@/lib/taskRepository";
import { authorizeJournalismPermission } from "@/lib/journalismAuthorization";
import { asIsoDate, parseArticleUrl, parseWithdrawalReason } from "@/lib/journalismMutationValidation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const taskId = asUuid((await context.params).id);
  const body = await readJsonObject(request);
  const status = body?.status;
  if (!taskId || !body || !["not_published", "scheduled", "published", "withdrawn"].includes(String(status))) return apiError("invalid_request", 400);
  const access = await taskRepository.access(taskId);
  if (!access.ok || !access.data) return apiError("not_found", 404);
  if (!await authorizeJournalismPermission(guard.actor, access.data, "journalism.publication.manage")) return apiError("forbidden", 403);
  if (Object.keys(body).some((key) => !["status", "plannedPublicationAt", "articleUrl", "reason"].includes(key))) return apiError("invalid_request", 400);
  const planned = asIsoDate(body.plannedPublicationAt);
  const url = status === "published" ? parseArticleUrl(body.articleUrl) : { ok: true as const, value: null };
  const reason = status === "withdrawn" ? parseWithdrawalReason(body.reason) : { ok: true as const, value: null };
  if (planned === undefined || !url.ok || !reason.ok) return apiError("invalid_request", 400);
  const { data, error } = await serverSupabase.rpc("api_change_journalism_publication_v1", {
    p_actor_id: guard.actor.id, p_task_id: taskId, p_status: status,
    p_planned_publication_at: planned, p_article_url: url.value, p_reason: reason.value,
  });
  return error ? rpcFailure(error) : apiJson({ journalism: data });
}
