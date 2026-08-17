import "server-only";

import { canEvaluationAction } from "@/lib/authorization";
import { evaluationRepository } from "@/lib/evaluationRepository";
import { apiError, apiJson, asUuid, readJsonObject, requireMutationActor, rpcFailure } from "@/lib/serverApi";

const mutation = async (request: Request) => {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = await readJsonObject(request);
  if (!body || typeof body.action !== "string") return apiError("invalid_request", 400);
  const actor = guard.actor;
  const actorId = actor.id;
  const authActor = { id: actor.id, departmentId: actor.department_id, roleCode: actor.role_code, roleLevel: actor.role_level, permissions: actor.permissions };
  let rpc: string; let args: Record<string, unknown>;
  switch (body.action) {
    case "clone":
      if (!canEvaluationAction(authActor, { action: "manage_rubrics" })) return apiError("forbidden", 403);
      rpc = "api_clone_evaluation_rubric"; args = { p_actor: actorId, p_source: asUuid(body.rubricId) }; break;
    case "update":
      if (!canEvaluationAction(authActor, { action: "manage_rubrics" })) return apiError("forbidden", 403);
      rpc = "api_update_evaluation_rubric"; args = { p_actor: actorId, p_rubric: asUuid(body.rubricId), p_factors: body.factors }; break;
    case "publish":
      if (!canEvaluationAction(authActor, { action: "manage_rubrics" })) return apiError("forbidden", 403);
      rpc = "api_publish_evaluation_rubric"; args = { p_actor: actorId, p_rubric: asUuid(body.rubricId), p_effective_from: body.effectiveFrom }; break;
    case "retire":
      if (!canEvaluationAction(authActor, { action: "manage_rubrics" })) return apiError("forbidden", 403);
      rpc = "api_retire_evaluation_rubric"; args = { p_actor: actorId, p_rubric: asUuid(body.rubricId) }; break;
    case "open_cycle":
      if (actor.role_code !== "admin") return apiError("forbidden", 403);
      rpc = "api_open_performance_cycle"; args = { p_actor: actorId, p_code: body.code, p_name: body.name, p_start: body.startDate, p_end: body.endDate }; break;
    default: return apiError("invalid_request", 400);
  }
  if (Object.values(args).some((value) => value === null)) return apiError("invalid_request", 400);
  const result = await evaluationRepository.rpc(rpc, args);
  return result.error ? rpcFailure(result.error) : apiJson({ data: result.data });
};

const createReview = async (request: Request) => {
  const guard = await requireMutationActor(); if (!guard.ok) return guard.response;
  const body = await readJsonObject(request); const cycleId = asUuid(body?.cycleId);
  if (!cycleId) return apiError("invalid_request", 400);
  const result = await evaluationRepository.rpc("api_create_performance_review", { p_actor: guard.actor.id, p_cycle: cycleId, p_employee: guard.actor.id });
  return result.error ? rpcFailure(result.error) : apiJson({ data: result.data }, 201);
};

const submit = async (request: Request, reviewId: string) => {
  const guard = await requireMutationActor(); if (!guard.ok) return guard.response;
  const id = asUuid(reviewId); const body = await readJsonObject(request);
  if (!id || !body || !Array.isArray(body.scores)) return apiError("invalid_request", 400);
  const names: Record<string, string> = { self: "api_submit_self_evaluation", manager: "api_submit_manager_evaluation", tbt: "api_publish_tbt_evaluation" };
  const rpc = typeof body.action === "string" ? names[body.action] : undefined;
  if (!rpc) return apiError("invalid_request", 400);
  const result = await evaluationRepository.rpc(rpc, { p_actor: guard.actor.id, p_review: id, p_scores: body.scores });
  return result.error ? rpcFailure(result.error) : apiJson({ data: result.data });
};

export const evaluationHandlers = { rubricMutation: mutation, createReview, submit };
