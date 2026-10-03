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
import { departmentPlanRepository, type DepartmentPlanLinkedTask } from "@/lib/departmentPlanRepository";
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
  if (error?.code === "23514" || error?.code === "22023" || error?.code === "22007" || error?.code === "22P02" || error?.code === "P0001") return apiError("invalid_request", 400);
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

async function hydrateAssignedProjection(itemId: string, fallbackTask: DepartmentPlanLinkedTask) {
  const linkedItem = await departmentPlanRepository.getItem(itemId);
  if (linkedItem.error) return { error: repositoryError(linkedItem.error) } as const;
  if (!linkedItem.data) return { error: apiError("not_found", 404) } as const;
  const linkedTask = await departmentPlanRepository.getLinkedTask(itemId);
  if (linkedTask.error) return { error: repositoryError(linkedTask.error) } as const;
  const task = linkedTask.data ?? fallbackTask;
  return {
    task,
    item: {
      ...linkedItem.data,
      linked_task_status: task?.status ?? null,
      linked_task_assignees: task?.task_assignees ?? [],
    },
  } as const;
}

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

async function candidates(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const url = new URL(request.url);
  const target = parseTargetDepartment(url.searchParams.get("departmentId"));
  const scope = scopeFor(guard.actor, target);
  if (!scope) return apiError("forbidden", 403);
  const period = parsePeriod(url.searchParams.get("periodType") ?? "weekly", url.searchParams.get("periodStart"));
  if (!period) return apiError("invalid_request", 400);
  const result = await departmentPlanRepository.candidates(guard.actor.id, scope.departmentId, period.periodType, period.periodStart, period.periodEnd);
  if (result.error) return repositoryError(result.error);
  return apiJson({ candidates: Array.isArray(result.data) ? result.data : [] });
}

async function createPlanV2(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = await readJsonObject(request);
  const target = parseTargetDepartment(body?.departmentId);
  const scope = scopeFor(guard.actor, target);
  if (!scope) return apiError("forbidden", 403);
  const period = parsePeriod(body?.periodType ?? "weekly", body?.periodStart);
  if (!period || !Array.isArray(body?.items)) return apiError("invalid_request", 400);
  const result = await departmentPlanRepository.createPlanV2(guard.actor.id, scope.departmentId, period.periodType, period.periodStart, period.periodEnd, body.items);
  if (result.error) return repositoryError(result.error);
  return apiJson({ plan: result.data }, 201);
}

async function closePlan(request: Request, planId: string) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const id = asUuid(planId);
  if (!id) return apiError("invalid_request", 400);
  const plan = await departmentPlanRepository.getPlan(id);
  if (plan.error) return repositoryError(plan.error);
  if (!plan.data || !scopeFor(guard.actor, plan.data.department_id)) return apiError("forbidden", 403);
  const body = await readJsonObject(request);
  const decisions = Array.isArray(body?.decisions) ? body.decisions : [];
  const closeNote = body?.closeNote === null || body?.closeNote === undefined ? null : typeof body.closeNote === "string" ? body.closeNote.trim() : null;
  const result = await departmentPlanRepository.closePlan(guard.actor.id, id, decisions, closeNote);
  if (result.error) return repositoryError(result.error);
  return apiJson({ plan: result.data });
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

const parseUuidArray = (value: unknown, required = false): string[] | null => {
  if (!Array.isArray(value)) return null;
  const ids: string[] = [];
  for (const candidate of value) {
    const id = asUuid(candidate);
    if (!id) return null;
    if (!ids.includes(id)) ids.push(id);
  }
  return required && ids.length === 0 ? null : ids;
};

function parseItemPatch(body: Record<string, unknown>, creating = false) {
  const patch: Record<string, unknown> = {};
  for (const key of ["description", "requirements"]) {
    if (key in body && body[key] !== null && typeof body[key] !== "string") return null;
    if (key in body) patch[key] = body[key];
  }
  if ("due_at" in body && body.due_at !== null && typeof body.due_at !== "string") return null;
  if (typeof body.due_at === "string" && Number.isNaN(Date.parse(body.due_at))) return null;
  if ("due_at" in body) patch.due_at = body.due_at;
  // Assignment claims belong exclusively to the transactional assignment
  // routes. Keep the linked_task_id spelling here so direct writes cannot
  // smuggle a Task link through the generic Plan endpoint.
  if ("assignee_id" in body || "linked_task_id" in body) return null;
  if ("assignment_state" in body && !["unassigned", "department_wide"].includes(String(body.assignment_state))) return null;
  if ("assignment_state" in body) patch.assignment_state = body.assignment_state;
  if ("work_status" in body && !["planned", "in_progress", "completed", "cancelled"].includes(String(body.work_status))) return null;
  if ("work_status" in body) patch.work_status = body.work_status;
  if (!creating && "title" in body) {
    if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 500) return null;
    patch.title = body.title.trim();
  }
  if (creating && patch.assignment_state === "assigned") return null;
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

async function assignTask(request: Request, itemId: string) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const id = asUuid(itemId);
  if (!id) return apiError("invalid_request", 400);
  const body = await readJsonObject(request);
  if (!body) return apiError("invalid_request", 400);
  const requirements = Array.isArray(body.requirements)
    ? body.requirements.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean)
    : null;
  const assigneeIds = "assigneeIds" in body
    ? parseUuidArray(body.assigneeIds, true)
    : (() => {
      const primary = asUuid(body.assigneeId);
      const collaborators = parseUuidArray(body.collaboratorIds ?? [], false);
      return primary && collaborators ? [primary, ...collaborators.filter((id) => id !== primary)] : null;
    })();
  const watcherIds = parseUuidArray(body.watcherIds ?? [], false);
  if (typeof body.title !== "string" || typeof body.description !== "string"
      || !assigneeIds || typeof body.dueDate !== "string"
      || typeof body.dueTime !== "string" || !requirements
      || !watcherIds) return apiError("invalid_request", 400);
  const result = await departmentPlanRepository.assignTaskFromItem(guard.actor.id, id, {
    title: body.title,
    description: body.description,
    requirements,
    assigneeIds,
    dueDate: body.dueDate,
    dueTime: body.dueTime,
    priority: body.priority ?? "normal",
    collaboratorIds: assigneeIds.slice(1),
    watcherIds,
    recurrenceFrequency: body.recurrenceFrequency ?? null,
    recurrenceEndsOn: body.recurrenceEndsOn ?? null,
  });
  if (result.error) return repositoryError(result.error);
  if (!result.data) return apiError("operation_failed", 500);
  return apiJson({ task: result.data, linkedTaskId: result.data.id });
}

async function createAndAssignItem(request: Request, planId: string) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const id = asUuid(planId);
  if (!id) return apiError("invalid_request", 400);
  const plan = await departmentPlanRepository.getPlan(id);
  if (plan.error) return repositoryError(plan.error);
  if (!plan.data) return apiError("not_found", 404);
  if (!scopeFor(guard.actor, plan.data.department_id)) return apiError("forbidden", 403);

  const body = await readJsonObject(request);
  if (!body) return apiError("invalid_request", 400);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = body.description === undefined || body.description === null
    ? ""
    : typeof body.description === "string" ? body.description.trim() : null;
  const requirements = Array.isArray(body.requirements)
    ? body.requirements.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean)
    : body.requirements === undefined || body.requirements === null
      ? []
      : null;
  const assigneeIds = parseUuidArray(body.assigneeIds, true);
  const dueDate = typeof body.dueDate === "string" ? body.dueDate : "";
  const dueTime = typeof body.dueTime === "string" ? body.dueTime : "";
  const priority = typeof body.priority === "string" ? body.priority : "normal";
  if (!title || title.length > 500 || description === null || description.length > 10000
      || !requirements || requirements.length > 50 || !assigneeIds
      || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)
      || !/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime)
      || !["low", "normal", "high", "urgent"].includes(priority)) return apiError("invalid_request", 400);

  const result = await departmentPlanRepository.createAndAssignItem(guard.actor.id, id, {
    title,
    description,
    requirements,
    assigneeIds,
    dueDate,
    dueTime,
    priority,
    workStatus: body.workStatus ?? "planned",
    note: typeof body.note === "string" ? body.note.trim() : null,
  });
  if (result.error) return repositoryError(result.error);
  if (!result.data?.task || !result.data.item) return apiError("operation_failed", 500);
  const projection = await hydrateAssignedProjection(result.data.item.id, result.data.task);
  if ("error" in projection) return projection.error;
  return apiJson({ task: projection.task, item: serializeItem(projection.item), linkedTaskId: projection.task.id }, 201);
}

async function quickAssignTask(request: Request, itemId: string) {
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
  const assigneeIds = "assigneeIds" in (body ?? {})
    ? parseUuidArray(body?.assigneeIds, true)
    : (() => { const id = asUuid(body?.assigneeId); return id ? [id] : null; })();
  const dueDate = typeof body?.dueDate === "string" ? body.dueDate : "";
  const dueTime = typeof body?.dueTime === "string" ? body.dueTime : "";
  const priority = typeof body?.priority === "string" ? body.priority : "normal";
  const note = body?.note === null || body?.note === undefined ? null : typeof body.note === "string" ? body.note.trim() : undefined;
  if (!assigneeIds || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)
      || !/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime)
      || !["low", "normal", "high", "urgent"].includes(priority)
      || note === undefined || (note?.length ?? 0) > 2000) return apiError("invalid_request", 400);

  const result = await departmentPlanRepository.quickAssignTaskFromItem(guard.actor.id, id, {
    assigneeIds,
    dueDate,
    dueTime,
    priority: priority as "low" | "normal" | "high" | "urgent",
    note: note || null,
  });
  if (result.error) return repositoryError(result.error);
  if (!result.data) return apiError("operation_failed", 500);
  const projection = await hydrateAssignedProjection(id, result.data);
  if ("error" in projection) return projection.error;
  return apiJson({ task: projection.task, item: serializeItem(projection.item), linkedTaskId: projection.task.id }, 201);
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
  if (current.data.linked_task_id && "assignment_state" in (body ?? {})) return apiError("invalid_request", 400);
  const patch = parseItemPatch(body ?? {});
  if (!patch || !Object.keys(patch).length || "department_id" in (body ?? {}) || "department_plan_id" in (body ?? {})) return apiError("invalid_request", 400);
  if (current.data.linked_task_id && "work_status" in patch) return apiError("invalid_request", 400);
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

export const departmentPlanHandlers = { list, report, candidates, createPlan, createPlanV2, closePlan, listItems, createItem, createAndAssignItem, getItem, assignTask, quickAssignTask, createTask, updateItem, deleteItem };
