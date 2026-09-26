import "server-only";

import {
  apiError,
  apiJson,
  asUuid,
  readJsonObject,
  requireMutationActor,
  requireReadActor,
} from "@/lib/serverApi";
import { type AuthorizationActor } from "@/lib/authorization";
import type { ServerAuthUser } from "@/lib/serverSession";
import { resolveDepartmentPlanScope } from "@/lib/departmentPlanAuthorization";
import { getDepartmentPlanPeriod, isDepartmentPlanPeriodType } from "@/lib/departmentPlanPeriod";
import { departmentPlanRepository } from "@/lib/departmentPlanRepository";
import { loadAuthorizedDepartmentPlanReport } from "@/lib/departmentPlanReportService";

type Actor = ServerAuthUser;

const asActor = (actor: Actor): AuthorizationActor => ({
  id: actor.id,
  departmentId: actor.department_id,
  departmentCode: actor.department_code,
  roleCode: actor.role_code,
  roleLevel: actor.role_level,
  isDepartmentManager: actor.is_department_manager,
  permissions: actor.permissions,
});

const repositoryError = (error: { code?: string | null } | null | undefined) => {
  if (error?.code === "23505") return apiError("conflict", 409);
  if (error?.code === "40001") return apiError("conflict", 409);
  if (error?.code === "42501") return apiError("forbidden", 403);
  if (error?.code === "P0002") return apiError("not_found", 404);
  if (error?.code === "23514" || error?.code === "22023" || error?.code === "22007") return apiError("invalid_request", 400);
  return apiError("operation_failed", 500);
};

const scopeFor = (actor: Actor, requestedDepartmentId?: string | null) =>
  resolveDepartmentPlanScope(asActor(actor), requestedDepartmentId);

const parsePeriod = (periodType: unknown, periodStart: unknown) => {
  if (!isDepartmentPlanPeriodType(periodType)) return null;
  try {
    return getDepartmentPlanPeriod(periodType, typeof periodStart === "string" ? periodStart : null);
  } catch {
    return null;
  }
};

const parseTargetDepartment = (value: unknown) => value === undefined || value === null ? null : asUuid(value);

const serializePlan = (plan: unknown) => plan;
const serializeItem = (item: unknown) => item;

async function list(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const url = new URL(request.url);
  const target = parseTargetDepartment(url.searchParams.get("departmentId"));
  if (url.searchParams.get("departmentId") && !target) return apiError("invalid_request", 400);
  const scope = scopeFor(guard.actor, target);
  if (!scope) return apiError("forbidden", 403);
  const period = parsePeriod(url.searchParams.get("periodType") ?? "weekly", url.searchParams.get("periodStart"));
  if (!period) return apiError("invalid_request", 400);
  const result = await departmentPlanRepository.getPeriod(scope.departmentId, period.periodType, period.periodStart);
  if (result.error) return repositoryError(result.error);
  if (!result.data) return apiJson({ plan: null, items: [] });
  const items = await departmentPlanRepository.listPlanItems(result.data.id);
  if (items.error) return repositoryError(items.error);
  return apiJson({ plan: serializePlan(result.data), items: (items.data ?? []).map(serializeItem) });
}

async function report(request: Request) {
  const loaded = await loadAuthorizedDepartmentPlanReport(request);
  if (!loaded.ok) return loaded.response;
  const { report, filters } = loaded.data;
  return apiJson({
    period: report.period,
    plan: serializePlan(report.plan),
    employees: report.employees,
    filters,
    metrics: report.metrics,
    items: report.items,
  });
}

async function createPlan(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = await readJsonObject(request);
  const target = parseTargetDepartment(body?.departmentId);
  if (body?.departmentId !== undefined && !target) return apiError("invalid_request", 400);
  const scope = scopeFor(guard.actor, target);
  if (!scope) return apiError("forbidden", 403);
  const period = parsePeriod(body?.periodType ?? "weekly", body?.periodStart);
  if (!period) return apiError("invalid_request", 400);
  const result = await departmentPlanRepository.getOrCreatePlanForMutation(
    scope.departmentId,
    period.periodType,
    period.periodStart,
    period.periodEnd,
    guard.actor.id,
  );
  if (result.error) return repositoryError(result.error);
  return apiJson({ plan: serializePlan(result.data), items: [] }, 201);
}

async function listItems(request: Request, planId: string) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const id = asUuid(planId);
  if (!id) return apiError("invalid_request", 400);
  const plan = await departmentPlanRepository.getPlan(id);
  if (plan.error) return repositoryError(plan.error);
  if (!plan.data) return apiError("not_found", 404);
  if (!scopeFor(guard.actor, plan.data.department_id)) return apiError("forbidden", 403);
  const result = await departmentPlanRepository.listPlanItems(id);
  if (result.error) return repositoryError(result.error);
  return apiJson({ plan: serializePlan(plan.data), items: (result.data ?? []).map(serializeItem) });
}

async function createItem(request: Request, planId: string) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const id = asUuid(planId);
  if (!id) return apiError("invalid_request", 400);
  const plan = await departmentPlanRepository.getPlan(id);
  if (plan.error) return repositoryError(plan.error);
  if (!plan.data) return apiError("not_found", 404);
  if (!scopeFor(guard.actor, plan.data.department_id)) return apiError("forbidden", 403);
  const body = await readJsonObject(request);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 500) return apiError("invalid_request", 400);
  const patch = parseItemPatch(body ?? {}, true);
  if (!patch) return apiError("invalid_request", 400);
  const result = await departmentPlanRepository.createItem(id, guard.actor.id, { title, ...patch });
  if (result.error) return repositoryError(result.error);
  return apiJson({ item: serializeItem(result.data) }, 201);
}

function parseItemPatch(body: Record<string, unknown>, creating = false) {
  const patch: Record<string, unknown> = {};
  for (const key of ["description", "requirements"]) {
    if (key in body && body[key] !== null && typeof body[key] !== "string") return null;
    if (key in body) patch[key] = body[key];
  }
  if ("due_at" in body && body.due_at !== null && typeof body.due_at !== "string") return null;
  if (typeof body.due_at === "string" && Number.isNaN(Date.parse(body.due_at))) return null;
  if ("due_at" in body) patch.due_at = body.due_at;
  if ("assignee_id" in body) {
    if (body.assignee_id !== null && !asUuid(body.assignee_id)) return null;
    patch.assignee_id = body.assignee_id;
  }
  if ("assignment_state" in body && !["unassigned", "department_wide", "assigned"].includes(String(body.assignment_state))) return null;
  if ("assignment_state" in body) patch.assignment_state = body.assignment_state;
  if ("work_status" in body && !["planned", "in_progress", "completed", "cancelled"].includes(String(body.work_status))) return null;
  if ("work_status" in body) patch.work_status = body.work_status;
  if (!creating && "title" in body) {
    if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 500) return null;
    patch.title = body.title.trim();
  }
  const assignmentState = patch.assignment_state;
  const assigneeId = patch.assignee_id;
  if (assignmentState === "assigned" && !assigneeId) return null;
  if ((assignmentState === "unassigned" || assignmentState === "department_wide") && assigneeId) return null;
  return patch;
}

async function getItem(_request: Request, itemId: string) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const id = asUuid(itemId);
  if (!id) return apiError("invalid_request", 400);
  const result = await departmentPlanRepository.getItem(id);
  if (result.error) return repositoryError(result.error);
  if (!result.data) return apiError("not_found", 404);
  const plan = await departmentPlanRepository.getPlan(result.data.department_plan_id);
  if (plan.error) return repositoryError(plan.error);
  if (!plan.data) return apiError("not_found", 404);
  if (!scopeFor(guard.actor, plan.data.department_id)) return apiError("forbidden", 403);
  const linkedTask = result.data.linked_task_id
    ? await departmentPlanRepository.getLinkedTask(id)
    : { data: null, error: null };
  if (linkedTask.error) return repositoryError(linkedTask.error);
  return apiJson({
    item: serializeItem(result.data),
    plan: serializePlan(plan.data),
    linkedTask: linkedTask.data,
  });
}

async function createTask(request: Request, itemId: string) {
  void request;
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const id = asUuid(itemId);
  if (!id) return apiError("invalid_request", 400);
  const current = await departmentPlanRepository.getItem(id);
  if (current.error) return repositoryError(current.error);
  if (!current.data) return apiError("not_found", 404);
  const plan = await departmentPlanRepository.getPlan(current.data.department_plan_id);
  if (plan.error) return repositoryError(plan.error);
  if (!plan.data) return apiError("not_found", 404);
  if (!scopeFor(guard.actor, plan.data.department_id)) return apiError("forbidden", 403);
  const result = await departmentPlanRepository.createTaskFromItem(guard.actor.id, id);
  if (result.error) return repositoryError(result.error);
  return apiJson({ task: result.data, linkedTaskId: result.data.id });
}

async function updateItem(request: Request, itemId: string) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const id = asUuid(itemId);
  if (!id) return apiError("invalid_request", 400);
  const current = await departmentPlanRepository.getItem(id);
  if (current.error) return repositoryError(current.error);
  if (!current.data) return apiError("not_found", 404);
  const plan = await departmentPlanRepository.getPlan(current.data.department_plan_id);
  if (plan.error) return repositoryError(plan.error);
  if (!plan.data) return apiError("not_found", 404);
  if (!scopeFor(guard.actor, plan.data.department_id)) return apiError("forbidden", 403);
  const body = await readJsonObject(request);
  const patch = parseItemPatch(body ?? {});
  if (!patch || !Object.keys(patch).length || "linked_task_id" in (body ?? {}) || "department_id" in (body ?? {}) || "department_plan_id" in (body ?? {})) return apiError("invalid_request", 400);
  if ((patch.assignment_state === "unassigned" || patch.assignment_state === "department_wide") && patch.assignee_id === undefined) {
    patch.assignee_id = null;
  }
  const result = await departmentPlanRepository.updateItem(id, patch as never);
  if (result.error) return repositoryError(result.error);
  if (!result.data) return apiError("not_found", 404);
  return apiJson({ item: serializeItem(result.data) });
}

async function deleteItem(_request: Request, itemId: string) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const id = asUuid(itemId);
  if (!id) return apiError("invalid_request", 400);
  const current = await departmentPlanRepository.getItem(id);
  if (current.error) return repositoryError(current.error);
  if (!current.data) return apiError("not_found", 404);
  const plan = await departmentPlanRepository.getPlan(current.data.department_plan_id);
  if (plan.error) return repositoryError(plan.error);
  if (!plan.data) return apiError("not_found", 404);
  if (!scopeFor(guard.actor, plan.data.department_id)) return apiError("forbidden", 403);
  const result = await departmentPlanRepository.deleteItem(id);
  if (result.error) return repositoryError(result.error);
  return apiJson({ deleted: true });
}

export const departmentPlanHandlers = { list, report, createPlan, listItems, createItem, getItem, createTask, updateItem, deleteItem };
