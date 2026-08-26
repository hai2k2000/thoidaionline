import type {
  AuthorizationActor,
  TaskAccessSnapshot,
  TaskAction,
} from "./authorization";
import type { ServerAuthUser } from "./serverSession";
import { parseTaskListSearchParams } from "./taskFilters.mjs";
import type {
  AssignedTaskInput,
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
  error: (code: "forbidden" | "invalid_request" | "not_found" | "conflict" | "service_unavailable", status: number) => Response;
  rpcFailure: (error: { code?: string | null }) => Response;
  asUuid: (value: unknown) => string | null;
  canAssignToDepartment: (
    actor: AuthorizationActor,
    departmentId: string | null,
  ) => boolean;
  resolveAssignmentParticipants: (actor: AuthorizationActor, input: {
    departmentId: string; assigneeId: string; reviewerId: string;
    collaboratorIds: string[]; watcherIds: string[];
    groupDepartmentId: string | null; excludedMemberIds: string[];
  }) => Promise<{ ok: true; collaboratorIds: string[]; watcherIds: string[] } | { ok: false }>;
  canTaskAction: (
    actor: AuthorizationActor,
    task: TaskAccessSnapshot,
    action: TaskAction,
  ) => boolean;
  normalizeLegacyEvaluationInput: (
    input: Record<string, unknown>,
  ) => Omit<LegacyEvaluationInput, "employeeId">;
  newUuid: () => string;
  uploadPrivateAttachment: (path: string, data: ArrayBuffer, mimeType: string) => Promise<{ ok: true } | { ok: false; error: { code?: string | null } }>;
  removePrivateAttachment: (path: string) => Promise<void>;
  signPrivateAttachment: (path: string) => Promise<{ ok: true; url: string } | { ok: false; error: { code?: string | null } }>;
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

const dateValue = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : null;
};

const timeValue = (value: unknown) =>
  typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
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

    async submitStructuredProgress(request: Request, taskIdValue: unknown) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const { actor, body } = guarded;
      const taskId = await authorizeMutation(actor, taskIdValue, "report");
      if (taskId instanceof Response) return taskId;
      const reportedOn = dateValue(body.reportedOn);
      const reportStatus = ["in_progress", "blocked", "waiting", "nearly_done"]
        .find((value) => value === body.reportStatus);
      const progressText = cleanText(body.progressText, 10000);
      const blockers = cleanText(body.blockers, 10000) || null;
      if (!reportedOn || !reportStatus || !progressText || (reportStatus === "blocked" && !blockers)) {
        return deps.error("invalid_request", 400);
      }
      const result = await deps.repository.submitStructuredProgress(actor.id, taskId, {
        reportedOn, reportStatus, progressText, blockers,
      });
      return result.ok ? deps.json({ report: result.data }, 201) : deps.rpcFailure(result.error);
    },

    async submitQualitativeEvaluation(request: Request, taskIdValue: unknown) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const { actor, body } = guarded;
      const evaluationText = cleanText(body.evaluationText, 10000);
      const evaluationSource = body.evaluationSource === undefined
        ? "chatgpt"
        : body.evaluationSource === "chatgpt" || body.evaluationSource === "leader"
          ? body.evaluationSource
          : null;
      const suppliedDeadline = body.evaluationDeadline !== undefined
        && body.evaluationDeadline !== null
        && body.evaluationDeadline !== "";
      const evaluationDeadline = suppliedDeadline
        ? dateValue(body.evaluationDeadline)
        : null;
      if (!evaluationText || !evaluationSource || (suppliedDeadline && !evaluationDeadline)) {
        return deps.error("invalid_request", 400);
      }
      const taskId = await authorizeMutation(actor, taskIdValue,
        evaluationSource === "leader" ? "leader_evaluate" : "evaluate");
      if (taskId instanceof Response) return taskId;
      const result = await deps.repository.submitQualitativeEvaluation(actor.id, taskId, {
        evaluationText, evaluationDeadline, evaluationSource,
      });
      return result.ok
        ? deps.json({ evaluation: result.data }, 201)
        : deps.rpcFailure(result.error);
    },

    async generateAiEvaluation(request: Request, taskIdValue: unknown) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const taskId = await authorizeMutation(guarded.actor, taskIdValue, "evaluate");
      if (taskId instanceof Response) return taskId;
      return deps.error("service_unavailable", 503);
    },

    async submitAssignedCompletion(_request: Request, taskIdValue: unknown) {
      const guard = await deps.mutationActor();
      if (!guard.ok) return guard.response;
      const taskId = await authorizeMutation(guard.actor, taskIdValue, "complete_assigned");
      if (taskId instanceof Response) return taskId;
      const result = await deps.repository.submitAssignedCompletion(guard.actor.id, taskId);
      return result.ok ? deps.json({ task: result.data }) : deps.rpcFailure(result.error);
    },
    async reviewAssignedCompletion(request: Request, taskIdValue: unknown) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const { actor, body } = guarded;
      const taskId = await authorizeMutation(actor, taskIdValue, "review");
      if (taskId instanceof Response) return taskId;
      if (Array.isArray(body.requirementResults)) {
        const requirementScore = Number(body.requirementScore);
        const collaborationScore = Number(body.collaborationScore);
        const initiativeScore = Number(body.initiativeScore);
        const allowedScore = (score: number) => [5, 10, 15, 20].includes(score);
        if (!Number.isFinite(requirementScore) || requirementScore < 0 || requirementScore > 60 || !allowedScore(collaborationScore) || !allowedScore(initiativeScore)) return deps.error("invalid_request", 400);
        const results = body.requirementResults.filter((item) => item && typeof item === "object" && typeof (item as Record<string, unknown>).achieved === "boolean");
        if (results.length !== body.requirementResults.length) return deps.error("invalid_request", 400);
        const result = await deps.repository.scoreTaskCompletion(actor.id, taskId, results, requirementScore, collaborationScore, initiativeScore, cleanText(body.note, 2000) || null);
        return result.ok ? deps.json({ task: result.data }) : deps.rpcFailure(result.error);
      }
      const decision = body.decision === "approve" || body.decision === "return" ? body.decision : null;
      const reason = cleanText(body.reason, 2000) || null;
      if (!decision || (decision === "return" && !reason)) return deps.error("invalid_request", 400);
      const result = await deps.repository.reviewAssignedCompletion(actor.id, taskId, decision, reason);
      return result.ok ? deps.json({ task: result.data }) : deps.rpcFailure(result.error);
    },

    async cancelAssigned(request: Request, taskIdValue: unknown) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const { actor, body } = guarded;
      const taskId = await authorizeMutation(actor, taskIdValue, "assigned_cancel");
      if (taskId instanceof Response) return taskId;
      const reason = cleanText(body.reason, 2000);
      if (!reason) return deps.error("invalid_request", 400);
      const result = await deps.repository.cancelAssigned(actor.id, taskId, reason);
      return result.ok ? deps.json({ task: result.data }) : deps.rpcFailure(result.error);
    },

    async changeAssignedDeadline(request: Request, taskIdValue: unknown) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const { actor, body } = guarded;
      const taskId = await authorizeMutation(actor, taskIdValue, "update");
      if (taskId instanceof Response) return taskId;
      const dueDate = dateValue(body.dueDate);
      const reason = cleanText(body.reason, 2000);
      if (!dueDate || !reason) return deps.error("invalid_request", 400);
      const result = await deps.repository.changeAssignedDeadline(actor.id, taskId, dueDate, reason);
      return result.ok ? deps.json({ task: result.data }) : deps.rpcFailure(result.error);
    },

    async uploadAttachment(request: Request, taskIdValue: unknown) {
      const guard = await deps.mutationActor();
      if (!guard.ok) return guard.response;
      const taskId = await authorizeMutation(guard.actor, taskIdValue, "attachment");
      if (taskId instanceof Response) return taskId;
      const form = await request.formData().catch(() => null);
      const file = form?.get("file");
      const allowed = new Set(["application/pdf", "image/png", "image/jpeg",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
      const extensionMime: Record<string, string> = {
        pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
      const extension = file instanceof File ? file.name.split(".").pop()?.toLowerCase() ?? "" : "";
      const mimeType = file instanceof File && allowed.has(file.type) ? file.type : extensionMime[extension];
      if (!(file instanceof File) || file.size < 1 || file.size > 10485760 || !mimeType) {
        return deps.error("invalid_request", 400);
      }
      const storagePath = `${taskId}/${deps.newUuid()}.${extension}`;
      const upload = await deps.uploadPrivateAttachment(storagePath, await file.arrayBuffer(), mimeType);
      if (!upload.ok) return deps.rpcFailure(upload.error);
      const result = await deps.repository.addAttachmentMetadata(guard.actor.id, taskId, {
        storagePath, fileName: file.name.slice(0, 500), mimeType, sizeBytes: file.size,
      });
      if (!result.ok) {
        await deps.removePrivateAttachment(storagePath);
        return deps.rpcFailure(result.error);
      }
      return deps.json({ attachment: result.data }, 201);
    },

    async downloadAttachment(taskIdValue: unknown, attachmentIdValue: unknown) {
      const guard = await deps.readActor();
      if (!guard.ok) return guard.response;
      const taskId = deps.asUuid(taskIdValue);
      const attachmentId = deps.asUuid(attachmentIdValue);
      if (!taskId || !attachmentId) return deps.error("invalid_request", 400);
      const access = await taskGuard(guard.actor, taskId, "view");
      if (access instanceof Response) return access;
      const attachment = await deps.repository.attachment(taskId, attachmentId);
      if (!attachment.ok) return deps.rpcFailure(attachment.error);
      if (!attachment.data) return deps.error("not_found", 404);
      const signed = await deps.signPrivateAttachment(attachment.data.storage_path);
      return signed.ok ? deps.json({ url: signed.url }) : deps.rpcFailure(signed.error);
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
      const recurrenceFrequency = body.recurrenceFrequency === "daily" || body.recurrenceFrequency === "weekly" || body.recurrenceFrequency === "monthly" ? body.recurrenceFrequency : body.recurrenceFrequency === null ? null : undefined;
      const recurrenceEndsOn = body.recurrenceEndsOn === null ? null : dateValue(body.recurrenceEndsOn);
      if (!title || !description || !startDate || !dueDate || startDate > dueDate) {
        return deps.error("invalid_request", 400);
      }
      if (recurrenceFrequency === undefined || (body.recurrenceEndsOn !== null && !recurrenceEndsOn) || (recurrenceFrequency === null && recurrenceEndsOn !== null) || (recurrenceEndsOn !== null && recurrenceEndsOn < dueDate)) return deps.error("invalid_request", 400);
      const result = await deps.repository.createPersonal(actor.id, {
        title, description, startDate, dueDate, evaluationCriteria, recurrenceFrequency, recurrenceEndsOn,
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

    async adminEditTask(request: Request, taskIdValue: unknown) {
      const guarded = await guardedBody(request);
      if (guarded instanceof Response) return guarded;
      const { actor, body } = guarded;
      const taskId = await authorizeMutation(actor, taskIdValue, "admin_edit");
      if (taskId instanceof Response) return taskId;
      const title = cleanText(body.title, 500);
      const description = cleanText(body.description, 10000);
      const startDate = dateValue(body.startDate);
      const dueDate = dateValue(body.dueDate);
      const dueTime = body.dueTime === null || body.dueTime === "" ? null : timeValue(body.dueTime);
      const priority = ["low", "normal", "high", "urgent"].find((value) => value === body.priority);
      const status = ["new", "in_progress", "blocked", "waiting", "pending_review", "done", "rejected", "cancelled"].find((value) => value === body.status);
      const evaluationCriteria = cleanText(body.evaluationCriteria, 10000) || null;
      const reason = cleanText(body.reason, 2000);
      if (!title || !description || !startDate || !dueDate || startDate > dueDate || !priority || !status || !reason || (body.dueTime !== null && body.dueTime !== "" && !dueTime)) return deps.error("invalid_request", 400);
      const result = await deps.repository.adminEditTask(actor.id, taskId, { title, description, startDate, dueDate, dueTime, priority, status, evaluationCriteria, reason });
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
      // Legacy task creation accepted a client-selected reviewer and bypassed
      // the hardened assignment workflow. Keep the endpoint explicit until
      // all clients use /api/tasks/assign.
      return new Response(JSON.stringify({ error: "legacy_task_create_disabled", message: "Hãy sử dụng luồng giao việc mới." }), {
        status: 410,
        headers: { "content-type": "application/json" },
      });
      /* const actor = toActor(guard.actor);
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
      */
    },

    async assign(request: Request) {
      const guard = await deps.mutationActor();
      if (!guard.ok) return guard.response;
      const actor = toActor(guard.actor);
      const body = await bodyObject(request);
      const title = cleanText(body?.title, 500);
      const requirements = Array.isArray(body?.requirements) ? body.requirements.map((value) => cleanText(value, 2000)).filter(Boolean) : [];
      const description = requirements.map((value) => `- ${value}`).join("\n");
      const departmentId = deps.asUuid(body?.departmentId);
      const assigneeId = deps.asUuid(body?.assigneeId);
      const reviewerId = actor.id;
      const dueDate = dateValue(body?.dueDate);
      const dueTime = timeValue(body?.dueTime);
      const evaluationCriteria = JSON.stringify(requirements);
      const assignmentPriorities = ["low", "normal", "high", "urgent"] as const;
      const assignmentPriority = body?.priority === undefined
        ? "normal"
        : assignmentPriorities.find((value) => value === body.priority);
      const recurrenceFrequency = body?.recurrenceFrequency === "daily"
        || body?.recurrenceFrequency === "weekly"
        || body?.recurrenceFrequency === "monthly"
        ? body.recurrenceFrequency
        : body?.recurrenceFrequency === null ? null : undefined;
      const recurrenceEndsOn = body?.recurrenceEndsOn === null
        ? null : dateValue(body?.recurrenceEndsOn);
      const ids = (value: unknown) => Array.isArray(value)
        ? [...new Set(value.map(deps.asUuid).filter((id): id is string => id !== null))]
        : null;
      const collaboratorIds = ids(body?.collaboratorIds);
      const watcherIds = ids(body?.watcherIds);
      const groupDepartmentId = body?.groupDepartmentId === undefined || body?.groupDepartmentId === null
        ? null : deps.asUuid(body.groupDepartmentId);
      const excludedMemberIds = body?.excludedMemberIds === undefined ? [] : ids(body.excludedMemberIds);
      if (!title || requirements.length < 1 || requirements.length > 50 || !departmentId || !assigneeId || !reviewerId
        || !dueDate || !dueTime || !assignmentPriority || !collaboratorIds || !watcherIds || !excludedMemberIds
        || (body?.groupDepartmentId !== undefined && body?.groupDepartmentId !== null && !groupDepartmentId)
        || recurrenceFrequency === undefined
        || (body?.recurrenceEndsOn !== null && !recurrenceEndsOn)
        || (recurrenceFrequency === null && recurrenceEndsOn !== null)
        || (recurrenceEndsOn !== null && recurrenceEndsOn < dueDate)) {
        return deps.error("invalid_request", 400);
      }
      if (!deps.canAssignToDepartment(actor, departmentId)) {
        return deps.error("forbidden", 403);
      }
      const resolved = await deps.resolveAssignmentParticipants(actor, {
        departmentId, assigneeId, reviewerId, collaboratorIds, watcherIds,
        groupDepartmentId, excludedMemberIds,
      });
      if (!resolved.ok) return deps.error("invalid_request", 400);
      const input: AssignedTaskInput = {
        title, description, requirements, departmentId, assigneeId, reviewerId, dueDate, dueTime,
        evaluationCriteria,
        priority: assignmentPriority,
        collaboratorIds: resolved.collaboratorIds,
        watcherIds: resolved.watcherIds,
        recurrenceFrequency,
        recurrenceEndsOn,
      };
      const result = await deps.repository.assign(guard.actor.id, input);
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
      const priorities = ["low", "normal", "high", "urgent"] as const;
      const priority = priorities.find((value) => value === body?.priority);
      if (
        !body
        || (body.status !== undefined && !status)
        || (body.dueDate !== undefined && body.dueDate !== null && !dueDate)
        || (body.priority !== undefined && !priority)
        || (body.status === undefined && body.dueDate === undefined && body.priority === undefined)
      ) return deps.error("invalid_request", 400);
      const taskId = await authorizeMutation(actor, taskIdValue, "update");
      if (taskId instanceof Response) return taskId;
      const result = await deps.repository.update(actor.id, taskId, {
        ...(status ? { status } : {}),
        ...(body.dueDate !== undefined ? { dueDate } : {}),
        ...(priority ? { priority } : {}),
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
      const { body } = guarded;
      const employeeId = deps.asUuid(body?.employeeId);
      if (!employeeId) return deps.error("invalid_request", 400);
      try {
        deps.normalizeLegacyEvaluationInput({
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
      // legacy_evaluation_retired: Phase 8 keeps 1-10 checkpoints read-only.
      return deps.error("conflict", 409);
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
