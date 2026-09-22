import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";
import {
  apiError,
  apiJson,
  asUuid,
  readJsonObject,
  requireMutationActor,
  rpcFailure,
} from "@/lib/serverApi";
import { canCreateJournalismStructure, canManageJournalismStructure, loadJournalismStructureActor } from "@/lib/journalismStructureAuthorization";
import { canUseJournalism } from "@/lib/journalismScope.mjs";

const text = (value: unknown, max: number) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= max ? normalized : null;
};
const description = (value: unknown) => {
  if (value === null || value === undefined) return null;
  return typeof value === "string" && value.trim().length <= 5000 ? value.trim() : undefined;
};
const only = (body: Record<string, unknown> | null, allowed: Set<string>) =>
  body !== null && Object.keys(body).every((key) => allowed.has(key));

export const journalismStructureHandlers = {
  async createTopic(request: Request) {
    const guard = await requireMutationActor();
    if (!guard.ok) return guard.response;
    if (!canUseJournalism({ roleCode: guard.actor.role_code, departmentCode: guard.actor.department_code, rbacPermissions: guard.actor.rbacPermissions })) return apiError("forbidden", 403);
    const body = await readJsonObject(request);
    if (!only(body, new Set(["name", "description", "departmentId"]))) return apiError("invalid_request", 400);
    const name = text(body?.name, 200);
    const desc = description(body?.description);
    const departmentId = body?.departmentId === null ? null : asUuid(body?.departmentId);
    if (!name || desc === undefined || (body?.departmentId !== null && !departmentId)) return apiError("invalid_request", 400);
    const actor = await loadJournalismStructureActor(guard.actor);
    if (!canCreateJournalismStructure(actor, departmentId)) return apiError("forbidden", 403);
    const result = await serverSupabase.rpc("api_create_editorial_topic_v1", {
      p_actor_id: guard.actor.id, p_name: name, p_description: desc, p_department_id: departmentId,
    });
    return result.error ? rpcFailure(result.error) : apiJson({ topic: result.data }, 201);
  },
  async updateTopic(request: Request, topicId: string) {
    const guard = await requireMutationActor();
    if (!guard.ok) return guard.response;
    if (!canUseJournalism({ roleCode: guard.actor.role_code, departmentCode: guard.actor.department_code, rbacPermissions: guard.actor.rbacPermissions })) return apiError("forbidden", 403);
    const id = asUuid(topicId);
    const body = await readJsonObject(request);
    if (!id || !only(body, new Set(["name", "description"]))) return apiError("invalid_request", 400);
    const updateName = Object.hasOwn(body ?? {}, "name");
    const updateDescription = Object.hasOwn(body ?? {}, "description");
    const name = updateName ? text(body?.name, 200) : null;
    const desc = updateDescription ? description(body?.description) : null;
    if ((updateName && !name) || (updateDescription && desc === undefined) || (!updateName && !updateDescription)) return apiError("invalid_request", 400);
    const existing = await serverSupabase.from("editorial_topics").select("department_id").eq("id", id).maybeSingle();
    if (existing.error || !existing.data) return apiError("not_found", 404);
    const actor = await loadJournalismStructureActor(guard.actor);
    if (!canManageJournalismStructure(actor, { departmentId: existing.data.department_id })) return apiError("forbidden", 403);
    const result = await serverSupabase.rpc("api_update_editorial_topic_v1", {
      p_actor_id: guard.actor.id, p_topic_id: id, p_name: name, p_description: desc,
      p_update_name: updateName, p_update_description: updateDescription,
    });
    return result.error ? rpcFailure(result.error) : apiJson({ topic: result.data });
  },
  async archiveTopic(_request: Request, topicId: string) {
    const guard = await requireMutationActor();
    if (!guard.ok) return guard.response;
    if (!canUseJournalism({ roleCode: guard.actor.role_code, departmentCode: guard.actor.department_code, rbacPermissions: guard.actor.rbacPermissions })) return apiError("forbidden", 403);
    const id = asUuid(topicId);
    if (!id) return apiError("invalid_request", 400);
    const result = await serverSupabase.rpc("api_archive_editorial_topic_v1", { p_actor_id: guard.actor.id, p_topic_id: id });
    return result.error ? rpcFailure(result.error) : apiJson({ topic: result.data });
  },
  async createSeries(request: Request) {
    const guard = await requireMutationActor();
    if (!guard.ok) return guard.response;
    if (!canUseJournalism({ roleCode: guard.actor.role_code, departmentCode: guard.actor.department_code, rbacPermissions: guard.actor.rbacPermissions })) return apiError("forbidden", 403);
    const body = await readJsonObject(request);
    if (!only(body, new Set(["name", "description", "departmentId", "topicId"]))) return apiError("invalid_request", 400);
    const name = text(body?.name, 200);
    const desc = description(body?.description);
    const departmentId = body?.departmentId === null ? null : asUuid(body?.departmentId);
    const topicId = body?.topicId === null || body?.topicId === undefined ? null : asUuid(body?.topicId);
    if (!name || desc === undefined || (body?.departmentId !== null && !departmentId) || (body?.topicId !== null && body?.topicId !== undefined && !topicId)) return apiError("invalid_request", 400);
    const actor = await loadJournalismStructureActor(guard.actor);
    if (!canCreateJournalismStructure(actor, departmentId)) return apiError("forbidden", 403);
    const result = await serverSupabase.rpc("api_create_editorial_series_v1", {
      p_actor_id: guard.actor.id, p_name: name, p_description: desc, p_department_id: departmentId, p_topic_id: topicId,
    });
    return result.error ? rpcFailure(result.error) : apiJson({ series: result.data }, 201);
  },
  async updateSeries(request: Request, seriesId: string) {
    const guard = await requireMutationActor();
    if (!guard.ok) return guard.response;
    if (!canUseJournalism({ roleCode: guard.actor.role_code, departmentCode: guard.actor.department_code, rbacPermissions: guard.actor.rbacPermissions })) return apiError("forbidden", 403);
    const id = asUuid(seriesId);
    const body = await readJsonObject(request);
    if (!id || !only(body, new Set(["name", "description", "topicId"]))) return apiError("invalid_request", 400);
    const updateName = Object.hasOwn(body ?? {}, "name");
    const updateDescription = Object.hasOwn(body ?? {}, "description");
    const updateTopic = Object.hasOwn(body ?? {}, "topicId");
    const name = updateName ? text(body?.name, 200) : null;
    const desc = updateDescription ? description(body?.description) : null;
    const topicId = updateTopic && body?.topicId !== null ? asUuid(body?.topicId) : null;
    if ((updateName && !name) || (updateDescription && desc === undefined) || (updateTopic && body?.topicId !== null && !topicId) || (!updateName && !updateDescription && !updateTopic)) return apiError("invalid_request", 400);
    const existing = await serverSupabase.from("editorial_series").select("department_id").eq("id", id).maybeSingle();
    if (existing.error || !existing.data) return apiError("not_found", 404);
    const actor = await loadJournalismStructureActor(guard.actor);
    if (!canManageJournalismStructure(actor, { departmentId: existing.data.department_id })) return apiError("forbidden", 403);
    const result = await serverSupabase.rpc("api_update_editorial_series_v1", {
      p_actor_id: guard.actor.id, p_series_id: id, p_name: name, p_description: desc, p_topic_id: topicId,
      p_update_name: updateName, p_update_description: updateDescription, p_update_topic: updateTopic,
    });
    return result.error ? rpcFailure(result.error) : apiJson({ series: result.data });
  },
  async archiveSeries(_request: Request, seriesId: string) {
    const guard = await requireMutationActor();
    if (!guard.ok) return guard.response;
    const id = asUuid(seriesId);
    if (!id) return apiError("invalid_request", 400);
    const result = await serverSupabase.rpc("api_archive_editorial_series_v1", { p_actor_id: guard.actor.id, p_series_id: id });
    return result.error ? rpcFailure(result.error) : apiJson({ series: result.data });
  },
};
