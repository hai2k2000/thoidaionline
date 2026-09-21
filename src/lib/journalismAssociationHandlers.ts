import "server-only";

import { apiError, apiJson, asUuid, readJsonObject, requireMutationActor, rpcFailure } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";

const only = (body: Record<string, unknown> | null, allowed: Set<string>) =>
  body !== null && Object.keys(body).every((key) => allowed.has(key));

export const journalismAssociationHandlers = {
  async attachTopic(request: Request, taskIdValue: string) {
    const guard = await requireMutationActor();
    if (!guard.ok) return guard.response;
    const taskId = asUuid(taskIdValue);
    const body = await readJsonObject(request);
    const topicId = asUuid(body?.topicId);
    if (!taskId || !only(body, new Set(["topicId"])) || !topicId) return apiError("invalid_request", 400);
    const result = await serverSupabase.rpc("api_attach_editorial_topic_task_v1", {
      p_actor_id: guard.actor.id, p_task_id: taskId, p_topic_id: topicId,
    });
    return result.error ? rpcFailure(result.error) : apiJson({ association: { taskId, topicId } }, 201);
  },
  async detachTopic(request: Request, taskIdValue: string, topicIdValue: string) {
    const guard = await requireMutationActor();
    if (!guard.ok) return guard.response;
    const taskId = asUuid(taskIdValue);
    const topicId = asUuid(topicIdValue);
    if (!taskId || !topicId) return apiError("invalid_request", 400);
    const body = await readJsonObject(request).catch(() => null);
    if (body !== null) return apiError("invalid_request", 400);
    const result = await serverSupabase.rpc("api_detach_editorial_topic_task_v1", {
      p_actor_id: guard.actor.id, p_task_id: taskId, p_topic_id: topicId,
    });
    return result.error ? rpcFailure(result.error) : apiJson({ ok: true });
  },
  async attachSeries(request: Request, taskIdValue: string) {
    const guard = await requireMutationActor();
    if (!guard.ok) return guard.response;
    const taskId = asUuid(taskIdValue);
    const body = await readJsonObject(request);
    const seriesId = asUuid(body?.seriesId);
    if (!taskId || !only(body, new Set(["seriesId"])) || !seriesId) return apiError("invalid_request", 400);
    const result = await serverSupabase.rpc("api_attach_editorial_series_task_v1", {
      p_actor_id: guard.actor.id, p_task_id: taskId, p_series_id: seriesId,
    });
    return result.error ? rpcFailure(result.error) : apiJson({ membership: result.data });
  },
  async detachSeries(request: Request, taskIdValue: string) {
    const guard = await requireMutationActor();
    if (!guard.ok) return guard.response;
    const taskId = asUuid(taskIdValue);
    if (!taskId) return apiError("invalid_request", 400);
    const body = await readJsonObject(request).catch(() => null);
    if (body !== null) return apiError("invalid_request", 400);
    const result = await serverSupabase.rpc("api_detach_editorial_series_task_v1", {
      p_actor_id: guard.actor.id, p_task_id: taskId,
    });
    return result.error ? rpcFailure(result.error) : apiJson({ ok: true });
  },
  async reorderSeries(request: Request, seriesIdValue: string) {
    const guard = await requireMutationActor();
    if (!guard.ok) return guard.response;
    const seriesId = asUuid(seriesIdValue);
    const body = await readJsonObject(request);
    const taskIds = Array.isArray(body?.taskIds) ? body.taskIds.map(asUuid) : null;
    if (!seriesId || !only(body, new Set(["taskIds"])) || !taskIds || taskIds.some((id) => id === null)) {
      return apiError("invalid_request", 400);
    }
    const result = await serverSupabase.rpc("api_reorder_editorial_series_v1", {
      p_actor_id: guard.actor.id, p_series_id: seriesId, p_task_ids: taskIds,
    });
    return result.error ? rpcFailure(result.error) : apiJson({ ok: true });
  },
};
