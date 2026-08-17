import type {
  AuthorizationActor,
  TaskAccessSnapshot,
  TaskAction,
} from "./authorization";
import type { ServerAuthUser } from "./serverSession";
import { parseTaskListSearchParams } from "./taskFilters.mjs";
import type {
  LegacyCreateTaskInput,
  LegacyEvaluationInput,
  TaskRepository,
} from "./taskContracts";

type Guard =
  | { ok: true; actor: ServerAuthUser }
  | { ok: false; response: Response };

type Dependencies = {
  repository: TaskRepository;
  readActor: () => Promise<Guard>;
  mutationActor: () => Promise<Guard>;
  json: (body: unknown, status?: number) => Response;
  error: (code: "forbidden" | "invalid_request" | "not_found", status: number) => Response;
  rpcFailure: (error: { code?: string | null }) => Response;
  asUuid: (value: unknown) => string | null;
  canAssignToDepartment: (
    actor: AuthorizationActor,
    departmentId: string | null,
  ) => boolean;
  canTaskAction: (
    actor: AuthorizationActor,
    task: TaskAccessSnapshot,
    action: TaskAction,
  ) => boolean;
  normalizeLegacyEvaluationInput: (
    input: Record<string, unknown>,
  ) => Omit<LegacyEvaluationInput, "employeeId">;
  newUuid: () => string;
};

const toActor = (user: ServerAuthUser): AuthorizationActor => ({
  id: user.id,
  departmentId: user.department_id,
  roleCode: user.role_code,
  roleLevel: user.role_level,
  permissions: user.permissions,
});

const bodyObject = async (
  request: Request,
): Promise<Record<string, unknown> | null> => {
  const value = await request.json().catch(() => null);
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
};

const cleanText = (value: unknown, max: number) => {
  if (typeof value !== "string") return "";
  const normalized = value.normalize("NFC").trim();
  return [...normalized].length <= max ? normalized : "";
};

const dateValue = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : null;

export function createTaskApplication(deps: Dependencies) {
  const taskGuard = async (
    user: ServerAuthUser,
    taskId: string,
    action: TaskAction,
  ) => {
    const accessResult = await deps.repository.access(taskId);
    if (!accessResult.ok) return deps.rpcFailure(accessResult.error);
    if (!accessResult.data) return deps.error("not_found", 404);
    return deps.canTaskAction(toActor(user), accessResult.data, action)
      ? accessResult.data
      : deps.error("forbidden", 403);
  };

  const guardedBody = async (request: Request) => {
    const guard = await deps.mutationActor();
    if (!guard.ok) return guard.response;
    const body = await bodyObject(request);
    if (!body) return deps.error("invalid_request", 400);
    return { actor: guard.actor, body };
  };

  const authorizeMutation = async (
    actor: ServerAuthUser,
    taskIdValue: unknown,
    action: TaskAction,
  ) => {
    const taskId = deps.asUuid(taskIdValue);
    if (!taskId) return deps.error("invalid_request", 400);
    const access = await taskGuard(actor, taskId, action);
    if (access instanceof Response) return access;
    return taskId;
  };

  return {
    async list(request: Request) {
      const guard = await deps.readActor();
      if (!guard.ok) return guard.response;
      const url = new URL(request.url);
      const query = parseTaskListSearchParams(url.searchParams);
      if (query.fromDate && query.toDate && query.fromDate > query.toDate) {
        return deps.error("invalid_request", 400);
      }
      const result = await deps.repository.list(toActor(guard.actor), query);
      return result.ok
        ? deps.json({ tasks: result.data })
        : deps.rpcFailure(result.error);
    },

    async detail(taskIdValue: unknown) {
      const guard = await deps.readActor();
      if (!guard.ok) return guard.response;
      const taskId = deps.asUuid(taskIdValue);
      if (!taskId) return deps.error("invalid_request", 400);
      const access = await taskGuard(guard.actor, taskId, "view");
      if (access instanceof Response) return access;
      const result = await deps.repository.detail(taskId);
      if (!result.ok) return deps.rpcFailure(result.error);
      if (!result.data) return deps.error("not_found", 404);
      const canViewAllLegacy = deps.canTaskAction(
        toActor(guard.actor),
        access,
        "legacy_evaluate",
      );
      return deps.json({
        task: {
          ...result.data,
          legacy_evaluations: canViewAllLegacy
            ? result.data.legacy_evaluations
            : result.data.legacy_evaluations.filter(
                (row) => row.employee_id === guard.actor.id,
              ),
        },
      });
    },

    async createPersonal(request: Request) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const { actor, body } = guarded;
      const title = cleanText(body.title, 500);
      const description = cleanText(body.description, 10000);
      const startDate = dateValue(body.startDate);
      const dueDate = dateValue(body.dueDate);
      const evaluationCriteria = cleanText(body.evaluationCriteria, 10000) || null;
      if (!title || !description || !startDate || !dueDate || startDate > dueDate) {
        return deps.error("invalid_request", 400);
      }
      const result = await deps.repository.createPersonal(actor.id, {
        title, description, startDate, dueDate, evaluationCriteria,
      });
      return result.ok
        ? deps.json({ task: result.data }, 201)
        : deps.rpcFailure(result.error);
    },

    async editPersonal(request: Request, taskIdValue: unknown) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const { actor, body } = guarded;
      const taskId = await authorizeMutation(actor, taskIdValue, "personal_edit");
      if (taskId instanceof Response) return taskId;
      const title = cleanText(body.title, 500);
      const description = cleanText(body.description, 10000);
      const startDate = dateValue(body.startDate);
      const evaluationCriteria = cleanText(body.evaluationCriteria, 10000) || null;
      if (!title || !description || !startDate) return deps.error("invalid_request", 400);
      const result = await deps.repository.editPersonal(actor.id, taskId, {
        title, description, startDate, evaluationCriteria,
      });
      return result.ok ? deps.json({ task: result.data }) : deps.rpcFailure(result.error);
    },

    async changePersonalDeadline(request: Request, taskIdValue: unknown) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const { actor, body } = guarded;
      const taskId = await authorizeMutation(actor, taskIdValue, "personal_deadline");
      if (taskId instanceof Response) return taskId;
      const dueDate = dateValue(body.dueDate);
      const reason = cleanText(body.reason, 2000);
      if (!dueDate || !reason) return deps.error("invalid_request", 400);
      const result = await deps.repository.changePersonalDeadline(
        actor.id, taskId, dueDate, reason,
      );
      return result.ok ? deps.json({ task: result.data }) : deps.rpcFailure(result.error);
    },

    async cancelPersonal(request: Request, taskIdValue: unknown) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const { actor, body } = guarded;
      const taskId = await authorizeMutation(actor, taskIdValue, "personal_cancel");
      if (taskId instanceof Response) return taskId;
      const reason = cleanText(body.reason, 2000);
      if (!reason) return deps.error("invalid_request", 400);
      const result = await deps.repository.cancelPersonal(actor.id, taskId, reason);
      return result.ok ? deps.json({ task: result.data }) : deps.rpcFailure(result.error);
    },

    async completePersonal(request: Request, taskIdValue: unknown) {
      const guard = await deps.mutationActor();
      if (!guard.ok) return guard.response;
      const taskId = await authorizeMutation(guard.actor, taskIdValue, "personal_complete");
      if (taskId instanceof Response) return taskId;
      const result = await deps.repository.completePersonal(guard.actor.id, taskId);
      return result.ok ? deps.json({ task: result.data }) : deps.rpcFailure(result.error);
    },

    async create(request: Request) {
      const guard = await deps.mutationActor();
      if (!guard.ok) return guard.response;
      const actor = toActor(guard.actor);
      const body = await bodyObject(request);
      const title = cleanText(body?.title, 500);
      const description = cleanText(body?.description, 10000);
      const assigneeId = deps.asUuid(body?.assigneeId);
      const reviewerId = deps.asUuid(body?.reviewerId);
      const departmentId = body?.departmentId === null
        ? null
        : deps.asUuid(body?.departmentId);
      const dueDate = dateValue(body?.dueDate);
      const modes = ["individual", "multi_user", "department", "mixed"] as const;
      const assignmentMode = modes.find((value) => value === body?.assignmentMode);
      const collaboratorIds = Array.isArray(body?.collaboratorIds)
        ? [...new Set(body.collaboratorIds.map(deps.asUuid).filter(
            (value): value is string => value !== null && value !== assigneeId,
          ))]
        : [];
      if (
        !title || !description || !assigneeId || !reviewerId
        || !dueDate || !assignmentMode
        || (body?.departmentId !== null && !departmentId)
      ) return deps.error("invalid_request", 400);
      if (!deps.canAssignToDepartment(actor, departmentId)) {
        return deps.error("forbidden", 403);
      }
      const input: LegacyCreateTaskInput = {
        title,
        description,
        departmentId,
        assigneeId,
        reviewerId,
        assignmentMode,
        dueDate,
        collaboratorIds,
      };
      const result = await deps.repository.create(guard.actor.id, input);
      return result.ok
        ? deps.json({ task: result.data }, 201)
        : deps.rpcFailure(result.error);
    },

    async update(request: Request, taskIdValue: unknown) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const { actor, body } = guarded;
      const statuses = ["new", "in_progress"] as const;
      const status = statuses.find((value) => value === body?.status);
      const dueDate = body?.dueDate === null ? null : dateValue(body?.dueDate);
      if (
        !body
        || (body.status !== undefined && !status)
        || (body.dueDate !== undefined && body.dueDate !== null && !dueDate)
        || (body.status === undefined && body.dueDate === undefined)
      ) return deps.error("invalid_request", 400);
      const taskId = await authorizeMutation(actor, taskIdValue, "update");
      if (taskId instanceof Response) return taskId;
      const result = await deps.repository.update(actor.id, taskId, {
        ...(status ? { status } : {}),
        ...(body.dueDate !== undefined ? { dueDate } : {}),
      });
      return result.ok
        ? deps.json({ task: result.data })
        : deps.rpcFailure(result.error);
    },

    async claim(request: Request) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const taskId = await authorizeMutation(
        guarded.actor, guarded.body.taskId, "claim",
      );
      if (taskId instanceof Response) return taskId;
      const result = await deps.repository.claim(guarded.actor.id, taskId);
      return result.ok
        ? deps.json({ task: result.data })
        : deps.rpcFailure(result.error);
    },

    async report(request: Request) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const { actor, body } = guarded;
      const progress = typeof body?.progress === "number"
        ? body.progress
        : Number(body?.progress);
      const report = cleanText(body?.report, 10000);
      const blockers = cleanText(body?.blockers, 10000) || null;
      if (!Number.isInteger(progress) || progress < 0 || progress > 100 || !report) {
        return deps.error("invalid_request", 400);
      }
      const taskId = await authorizeMutation(actor, body.taskId, "report");
      if (taskId instanceof Response) return taskId;
      const result = await deps.repository.report(
        actor.id, taskId, progress, report, blockers,
      );
      return result.ok
        ? deps.json({ task: result.data })
        : deps.rpcFailure(result.error);
    },

    async review(request: Request) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const { actor, body } = guarded;
      const decision = body?.decision === "approve" || body?.decision === "reject"
        ? body.decision
        : null;
      const note = cleanText(body?.note, 10000) || null;
      if (!decision) return deps.error("invalid_request", 400);
      const taskId = await authorizeMutation(actor, body.taskId, "review");
      if (taskId instanceof Response) return taskId;
      const result = await deps.repository.review(
        actor.id, taskId, decision, note,
      );
      return result.ok
        ? deps.json({ task: result.data })
        : deps.rpcFailure(result.error);
    },

    async evaluate(request: Request) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const { actor, body } = guarded;
      const employeeId = deps.asUuid(body?.employeeId);
      if (!employeeId) return deps.error("invalid_request", 400);
      let input: Omit<LegacyEvaluationInput, "employeeId">;
      try {
        input = deps.normalizeLegacyEvaluationInput({
          rating: body?.rating,
          effortWeight: body?.effortWeight,
          completion: body?.completion,
          onTime: body?.onTime,
          opinion: body?.opinion,
          checkpointDate: body?.checkpointDate,
          isFinal: body?.isFinal,
        });
      } catch {
        return deps.error("invalid_request", 400);
      }
      const taskId = await authorizeMutation(
        actor, body.taskId, "legacy_evaluate",
      );
      if (taskId instanceof Response) return taskId;
      const result = await deps.repository.evaluate(actor.id, taskId, {
        employeeId,
        rating: input.rating,
        effortWeight: input.effortWeight,
        completion: input.completion,
        onTime: input.onTime,
        opinion: input.opinion ?? null,
        checkpointDate: input.checkpointDate,
        isFinal: input.isFinal,
      });
      return result.ok ? deps.json({ ok: true }) : deps.rpcFailure(result.error);
    },

    async comment(request: Request, taskIdValue: unknown) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const { actor, body } = guarded;
      const content = cleanText(body?.content, 10000);
      if (!content) return deps.error("invalid_request", 400);
      const taskId = await authorizeMutation(actor, taskIdValue, "comment");
      if (taskId instanceof Response) return taskId;
      const result = await deps.repository.comment(actor.id, taskId, content);
      return result.ok
        ? deps.json({ comment: result.data }, 201)
        : deps.rpcFailure(result.error);
    },

    async bulkPlan(request: Request) {
      const guard = await deps.mutationActor();
      if (!guard.ok) return guard.response;
      const actor = toActor(guard.actor);
      if (
        ["tong_bien_tap", "tbt_read_only"].includes(actor.roleCode)
        || !actor.permissions.can_assign_task
      ) return deps.error("forbidden", 403);
      const body = await bodyObject(request);
      const planPeriod = body?.planPeriod === "daily" || body?.planPeriod === "weekly"
        ? body.planPeriod
        : null;
      const dueDate = dateValue(body?.dueDate);
      const reviewerId = deps.asUuid(body?.reviewerId);
      const description = cleanText(body?.description, 10000);
      const items = Array.isArray(body?.items)
        ? body.items.map((item) => ({
            title: cleanText(
              item && typeof item === "object"
                ? (item as Record<string, unknown>).title
                : null,
              500,
            ),
          }))
        : [];
      const batchId = deps.asUuid(body?.batchId) ?? deps.newUuid();
      if (
        !planPeriod || !dueDate || !reviewerId || !description
        || items.length < 1 || items.length > 100
        || items.some((item) => !item.title)
      ) return deps.error("invalid_request", 400);
      const result = await deps.repository.bulkPlan(guard.actor.id, {
        planPeriod,
        dueDate,
        reviewerId,
        description,
        items,
        batchId,
      });
      return result.ok
        ? deps.json({ batchId, tasks: result.data })
        : deps.rpcFailure(result.error);
    },
  };
}
