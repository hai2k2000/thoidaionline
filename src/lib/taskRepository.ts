import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";
import {
  hasOrganizationTaskView,
  type AuthorizationActor,
  type TaskAccessSnapshot,
  type TaskParticipant,
} from "@/lib/authorization";
import { resolveTaskCompatibility } from "@/lib/taskCompatibility";
import type {
  AssignedTaskInput,
  LegacyCreateTaskInput,
  LegacyEvaluationInput,
  LegacyUpdateTaskInput,
  PersonalTaskEditInput,
  PersonalTaskInput,
  RepositoryResult,
  TaskDetailDto,
  TaskListItemDto,
  TaskRepository,
} from "@/lib/taskContracts";

const TASK_LIST_FIELDS = [
  "id",
  "title",
  "priority",
  "created_at",
  "status",
  "task_type",
  "task_category",
  "duty_month",
  "start_date",
  "completion_submitted_at",
  "completed_at",
  "cancelled_at",
  "cancel_reason",
  "progress_percent",
  "due_date",
  "due_time",
  "assignee_id",
  "owner_id",
  "created_by",
  "reviewer_id",
  "department_id",
  "assignment_mode",
  "plan_period",
  "self_claimable",
  "departments(name)",
  "task_assignees(user_id,assignment_role,status,staff_users(full_name))",
].join(",");

const TASK_DETAIL_FIELDS = [
  TASK_LIST_FIELDS,
  "description",
  "attachment_url",
  "effort_weight",
  "evaluation_criteria",
  "owner:staff_users!tasks_owner_id_fkey(full_name)",
  "reviewer:staff_users!tasks_reviewer_id_fkey(full_name)",
].join(",");

type TaskAccessRow = {
  id: string;
  department_id: string | null;
  created_by: string | null;
  owner_id: string | null;
  assignee_id: string | null;
  reviewer_id: string | null;
  departments: { manager_id: string | null } | null;
  self_claimable: boolean;
  task_type: "assigned" | "personal" | null;
  status: string;
  task_assignees: {
    user_id: string;
    assignment_role: TaskParticipant["assignmentRole"];
  }[] | null;
};

const ok = <T>(data: T): RepositoryResult<T> => ({ ok: true, data });
const fail = <T>(error: { code?: string | null }): RepositoryResult<T> => ({
  ok: false,
  error: { code: error.code ?? null },
});

const mutation = async <T>(
  name: string,
  args: Record<string, unknown>,
): Promise<RepositoryResult<T>> => {
  const { data, error } = await serverSupabase.rpc(name, args);
  return error ? fail(error) : ok(data as T);
};

const toAccess = (row: TaskAccessRow): TaskAccessSnapshot => ({
  id: row.id,
  departmentId: row.department_id,
  createdBy: row.created_by,
  ownerId: row.owner_id,
  assigneeId: row.assignee_id,
  reviewerId: row.reviewer_id,
  departmentManagerId: row.departments?.manager_id ?? null,
  selfClaimable: row.self_claimable,
  taskType: row.task_type,
  status: row.status,
  participants: (row.task_assignees ?? []).map((participant) => ({
    userId: participant.user_id,
    assignmentRole: participant.assignment_role,
  })),
});

const scopeTerms = async (
  actor: AuthorizationActor,
): Promise<RepositoryResult<string[]>> => {
  if (hasOrganizationTaskView(actor)) {
    return ok([]);
  }
  const { data, error } = await serverSupabase
    .from("task_assignees")
    .select("task_id")
    .eq("user_id", actor.id);
  if (error) return fail(error);
  const taskIds = (data ?? []).map((row) => row.task_id as string);
  const terms = [
    `created_by.eq.${actor.id}`,
    `owner_id.eq.${actor.id}`,
    `assignee_id.eq.${actor.id}`,
    `reviewer_id.eq.${actor.id}`,
  ];
  if (
    actor.permissions.can_view_department_tasks
    && actor.departmentId !== null
  ) {
    terms.push(`department_id.eq.${actor.departmentId}`);
  }
  if (taskIds.length > 0) {
    terms.push(`id.in.(${taskIds.join(",")})`);
  }
  return ok(terms);
};

export const taskRepository: TaskRepository = {
  async list(actor, query) {
    const scope = await scopeTerms(actor);
    if (!scope.ok) return scope;

    let dbQuery = serverSupabase
      .from("tasks")
      .select(TASK_LIST_FIELDS, { count: "exact" })
      .order("created_at", { ascending: false });
    if (scope.data.length > 0) dbQuery = dbQuery.or(scope.data.join(","));
    if (query.scope === "personal") {
      dbQuery = dbQuery.eq("owner_id", actor.id).or(
        "task_type.eq.personal,and(task_type.is.null,plan_period.in.(daily,weekly,monthly))",
      );
    } else if (query.scope === "assigned") {
      dbQuery = dbQuery
        .or("task_type.eq.assigned,and(task_type.is.null,plan_period.eq.ad_hoc,self_claimable.eq.false)")
        .or(`owner_id.eq.${actor.id},assignee_id.eq.${actor.id}`);
    } else if (query.scope === "watching") {
      const watcher = await serverSupabase
        .from("task_assignees")
        .select("task_id")
        .eq("user_id", actor.id)
        .eq("assignment_role", "watcher");
      if (watcher.error) return fail(watcher.error);
      const watcherIds = (watcher.data ?? []).map((row) => row.task_id as string);
      if (watcherIds.length === 0) {
        return ok({ items: [], total: 0, page: query.page, pageSize: query.pageSize });
      }
      dbQuery = dbQuery.in("id", watcherIds);
    } else if (query.scope === "cancelled") {
      dbQuery = dbQuery.eq("status", "cancelled");
    }
    if (query.category === "duty") dbQuery = dbQuery.eq("task_category", "duty");
    if (query.taskType === "personal") {
      dbQuery = dbQuery.or(
        "task_type.eq.personal,and(task_type.is.null,plan_period.in.(daily,weekly,monthly))",
      );
    } else if (query.taskType === "assigned") {
      dbQuery = dbQuery.or("task_type.eq.assigned,and(task_type.is.null,plan_period.eq.ad_hoc,self_claimable.eq.false)");
    }
    if (query.scope !== "cancelled" && query.statusGroup !== "cancelled") {
      dbQuery = dbQuery.neq("status", "cancelled");
    }
    if (query.status) dbQuery = dbQuery.eq("status", query.status);
    if (query.statusGroup === "completed") dbQuery = dbQuery.eq("status", "done");
    if (query.statusGroup === "returned") dbQuery = dbQuery.eq("status", "rejected");
    if (query.statusGroup === "cancelled") dbQuery = dbQuery.eq("status", "cancelled");
    if (query.statusGroup === "unfinished") {
      dbQuery = dbQuery.in("status", [
        "new", "in_progress", "blocked", "waiting", "pending_review",
      ]);
    }
    if (query.search) dbQuery = dbQuery.ilike("title", `%${query.search}%`);
    if (query.fromDate) dbQuery = dbQuery.gte("start_date", query.fromDate);
    if (query.toDate) dbQuery = dbQuery.lte("due_date", query.toDate);
    if (query.departmentId) {
      const canUseDepartment = hasOrganizationTaskView(actor)
        || (actor.permissions.can_view_department_tasks
          && actor.departmentId === query.departmentId);
      if (!canUseDepartment) {
        return ok({ items: [], total: 0, page: query.page, pageSize: query.pageSize });
      }
      dbQuery = dbQuery.eq("department_id", query.departmentId);
    }
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const dueSoon = new Date(`${today}T00:00:00Z`);
    dueSoon.setUTCDate(dueSoon.getUTCDate() + 3);
    const dueSoonDate = dueSoon.toISOString().slice(0, 10);
    if (query.deadlineState === "no_deadline") dbQuery = dbQuery.is("due_date", null);
    if (query.deadlineState === "overdue") {
      dbQuery = dbQuery.lt("due_date", today).not("status", "in", "(done,cancelled)");
    }
    if (query.deadlineState === "due_soon") {
      dbQuery = dbQuery.gte("due_date", today).lte("due_date", dueSoonDate)
        .not("status", "in", "(done,cancelled)");
    }
    if (query.deadlineState === "on_time") dbQuery = dbQuery.gte("due_date", today);
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const { data, error, count } = await dbQuery.range(from, to);
    if (error) return fail(error);
    return ok({
      items: ((data ?? []) as unknown as TaskListItemDto[]).map((item) => ({
        ...item,
        ...resolveTaskCompatibility(item),
      })),
      total: count ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    });
  },

  async access(taskId) {
    const { data, error } = await serverSupabase
      .from("tasks")
      .select(
        "id,department_id,created_by,owner_id,assignee_id,reviewer_id,departments(manager_id)," +
        "self_claimable,task_type,status,task_assignees(user_id,assignment_role)",
      )
      .eq("id", taskId)
      .maybeSingle();
    if (error) return fail(error);
    return ok(data ? toAccess(data as unknown as TaskAccessRow) : null);
  },

  async detail(taskId) {
    const [taskResult, commentResult, legacyProgressResult, evaluationResult,
      progressResult, qualitativeEvaluationResult, deadlineResult, statusResult,
      attachmentResult] = await Promise.all([
      serverSupabase.from("tasks").select(TASK_DETAIL_FIELDS).eq("id", taskId).maybeSingle(),
      serverSupabase.from("task_comments")
        .select("id,content,created_at,user_id,staff_users(full_name)")
        .eq("task_id", taskId).order("created_at", { ascending: false }),
      serverSupabase.from("task_progress_logs")
        .select("id,old_progress,new_progress,note,created_at,user_id,staff_users!task_progress_logs_user_id_fkey(full_name)")
        .eq("task_id", taskId).order("created_at", { ascending: false }),
      serverSupabase.from("task_evaluation_checkpoints")
        .select("id,task_id,employee_id,reviewer_id,rating,effort_weight,total_score,completion,on_time,opinion,checkpoint_date,is_final,created_at")
        .eq("task_id", taskId).order("checkpoint_date", { ascending: false }).order("created_at", { ascending: false }),
      serverSupabase.from("task_progress_reports")
        .select("id,reported_by,reported_on,report_status,progress_text,blockers,created_at")
        .eq("task_id", taskId).order("reported_on", { ascending: false }).order("created_at", { ascending: false }),
      serverSupabase.from("task_qualitative_evaluations")
        .select("id,evaluation_text,evaluation_deadline,evaluation_source,created_at,evaluator:staff_users!task_qualitative_evaluations_evaluator_id_fkey(full_name)")
        .eq("task_id", taskId).order("created_at", { ascending: false }),
      serverSupabase.from("task_deadline_history")
        .select("id,old_due_date,new_due_date,reason,changed_at")
        .eq("task_id", taskId).order("changed_at", { ascending: false }),
      serverSupabase.from("task_status_events")
        .select("id,from_status,to_status,reason,created_at")
        .eq("task_id", taskId).order("created_at", { ascending: false }),
      serverSupabase.from("task_attachments")
        .select("id,file_name,mime_type,size_bytes,created_at,uploaded_by")
        .eq("task_id", taskId).order("created_at", { ascending: false }),
    ]);
    const error = taskResult.error ?? commentResult.error ?? legacyProgressResult.error
      ?? evaluationResult.error ?? progressResult.error ?? qualitativeEvaluationResult.error
      ?? deadlineResult.error
      ?? statusResult.error ?? attachmentResult.error;
    if (error) return fail(error);
    if (!taskResult.data) return ok(null);
    return ok({
      ...(taskResult.data as unknown as Omit<TaskDetailDto,
        "comments" | "progress_logs" | "legacy_evaluations" | "progress_reports"
        | "qualitative_evaluations"
        | "deadline_history" | "status_events" | "attachments">),
      ...resolveTaskCompatibility(taskResult.data as unknown as TaskListItemDto),
      comments: (commentResult.data ?? []) as unknown as TaskDetailDto["comments"],
      progress_logs: (legacyProgressResult.data ?? []) as unknown as TaskDetailDto["progress_logs"],
      legacy_evaluations: (evaluationResult.data ?? []) as unknown as TaskDetailDto["legacy_evaluations"],
      progress_reports: (progressResult.data ?? []) as unknown as TaskDetailDto["progress_reports"],
      qualitative_evaluations: (qualitativeEvaluationResult.data ?? []) as unknown as TaskDetailDto["qualitative_evaluations"],
      deadline_history: (deadlineResult.data ?? []) as unknown as TaskDetailDto["deadline_history"],
      status_events: (statusResult.data ?? []) as unknown as TaskDetailDto["status_events"],
      attachments: (attachmentResult.data ?? []) as unknown as TaskDetailDto["attachments"],
    });
  },

  create: (actorId, input: LegacyCreateTaskInput) => mutation(
    "api_create_task",
    {
      p_actor_id: actorId,
      p_title: input.title,
      p_description: input.description,
      p_department_id: input.departmentId,
      p_assignee_id: input.assigneeId,
      p_reviewer_id: input.reviewerId,
      p_assignment_mode: input.assignmentMode,
      p_due_date: input.dueDate,
      p_collaborator_ids: input.collaboratorIds,
    },
  ),

  assign: (actorId, input: AssignedTaskInput) => mutation(
    "api_assign_task_v2",
    {
      p_actor_id: actorId,
      p_title: input.title,
      p_description: input.description,
      p_department_id: input.departmentId,
      p_assignee_id: input.assigneeId,
      p_reviewer_id: input.reviewerId,
      p_due_date: input.dueDate,
      p_due_time: input.dueTime,
      p_evaluation_criteria: input.evaluationCriteria,
      p_priority: input.priority,
      p_collaborator_ids: input.collaboratorIds,
      p_watcher_ids: input.watcherIds,
      p_recurrence_frequency: input.recurrenceFrequency,
      p_recurrence_ends_on: input.recurrenceEndsOn,
    },
  ),

  createPersonal: (actorId, input: PersonalTaskInput) => mutation(
    "api_create_personal_task_v2",
    {
      p_actor_id: actorId, p_title: input.title, p_description: input.description,
      p_start_date: input.startDate, p_due_date: input.dueDate,
      p_evaluation_criteria: input.evaluationCriteria,
      p_recurrence_frequency: input.recurrenceFrequency,
      p_recurrence_ends_on: input.recurrenceEndsOn,
    },
  ),

  editPersonal: (actorId, taskId, input: PersonalTaskEditInput) => mutation(
    "api_edit_personal_task",
    {
      p_actor_id: actorId, p_task_id: taskId, p_title: input.title,
      p_description: input.description, p_start_date: input.startDate,
      p_evaluation_criteria: input.evaluationCriteria,
    },
  ),

  changePersonalDeadline: (actorId, taskId, dueDate, reason) => mutation(
    "api_change_personal_task_deadline",
    { p_actor_id: actorId, p_task_id: taskId, p_new_due_date: dueDate, p_reason: reason },
  ),

  cancelPersonal: (actorId, taskId, reason) => mutation(
    "api_cancel_personal_task",
    { p_actor_id: actorId, p_task_id: taskId, p_reason: reason },
  ),

  completePersonal: (actorId, taskId) => mutation(
    "api_complete_personal_task",
    { p_actor_id: actorId, p_task_id: taskId },
  ),
  adminEditTask: (actorId, taskId, input) => mutation("api_admin_edit_task", {
    p_actor_id: actorId, p_task_id: taskId, p_title: input.title,
    p_description: input.description, p_start_date: input.startDate,
    p_due_date: input.dueDate, p_due_time: input.dueTime,
    p_priority: input.priority, p_status: input.status,
    p_evaluation_criteria: input.evaluationCriteria, p_reason: input.reason,
  }),

  submitStructuredProgress: (actorId, taskId, input) => mutation(
    "api_submit_task_progress_report",
    { p_actor_id: actorId, p_task_id: taskId, p_reported_on: input.reportedOn,
      p_report_status: input.reportStatus, p_progress_text: input.progressText,
      p_blockers: input.blockers },
  ),
  submitQualitativeEvaluation: (actorId, taskId, input) => mutation(
    "api_submit_task_qualitative_evaluation",
    { p_actor_id: actorId, p_task_id: taskId,
      p_evaluation_text: input.evaluationText,
      p_evaluation_deadline: input.evaluationDeadline,
      p_evaluation_source: input.evaluationSource },
  ),
  submitAssignedCompletion: (actorId, taskId) => mutation(
    "api_submit_assigned_task_completion", { p_actor_id: actorId, p_task_id: taskId },
  ),
  reviewAssignedCompletion: (actorId, taskId, decision, reason) => mutation(
    "api_review_assigned_task_completion",
    { p_actor_id: actorId, p_task_id: taskId, p_decision: decision, p_reason: reason },
  ),
  cancelAssigned: (actorId, taskId, reason) => mutation(
    "api_cancel_assigned_task", { p_actor_id: actorId, p_task_id: taskId, p_reason: reason },
  ),
  changeAssignedDeadline: (actorId, taskId, dueDate, reason) => mutation(
    "api_change_assigned_task_deadline",
    { p_actor_id: actorId, p_task_id: taskId, p_new_due_date: dueDate, p_reason: reason },
  ),
  addAttachmentMetadata: (actorId, taskId, input) => mutation(
    "api_add_task_attachment",
    { p_actor_id: actorId, p_task_id: taskId, p_storage_path: input.storagePath,
      p_file_name: input.fileName, p_mime_type: input.mimeType, p_size_bytes: input.sizeBytes },
  ),
  async attachment(taskId, attachmentId) {
    const { data, error } = await serverSupabase.from("task_attachments")
      .select("id,file_name,mime_type,size_bytes,created_at,uploaded_by,storage_path")
      .eq("task_id", taskId).eq("id", attachmentId).maybeSingle();
    return error ? fail(error) : ok(data as unknown as (TaskDetailDto["attachments"][number] & { storage_path: string }) | null);
  },

  update: (actorId, taskId, input: LegacyUpdateTaskInput) => mutation(
    "api_update_task",
    {
      p_actor_id: actorId,
      p_task_id: taskId,
      p_status: input.status ?? null,
      p_due_date: input.dueDate ?? null,
      p_update_due_date: input.dueDate !== undefined,
      p_priority: input.priority ?? null,
      p_update_priority: input.priority !== undefined,
    },
  ),

  claim: (actorId, taskId) => mutation(
    "api_claim_task_plan",
    { p_actor_id: actorId, p_task_id: taskId },
  ),

  report: (actorId, taskId, progress, report, blockers) => mutation(
    "api_report_task_progress",
    {
      p_actor_id: actorId,
      p_task_id: taskId,
      p_progress: progress,
      p_report: report,
      p_blockers: blockers,
    },
  ),

  review: (actorId, taskId, decision, note) => mutation(
    "api_review_task_completion",
    {
      p_actor_id: actorId,
      p_task_id: taskId,
      p_decision: decision,
      p_note: note,
    },
  ),

  evaluate: (actorId, taskId, input: LegacyEvaluationInput) => mutation(
    "api_save_task_evaluation_checkpoint",
    {
      p_actor_id: actorId,
      p_task_id: taskId,
      p_employee_id: input.employeeId,
      p_rating: input.rating,
      p_effort_weight: input.effortWeight,
      p_completion: input.completion,
      p_on_time: input.onTime,
      p_opinion: input.opinion,
      p_checkpoint_date: input.checkpointDate,
      p_is_final: input.isFinal,
    },
  ),

  comment: (actorId, taskId, content) => mutation(
    "api_add_task_comment",
    { p_actor_id: actorId, p_task_id: taskId, p_content: content },
  ),

  bulkPlan: (actorId, input) => mutation(
    "api_create_bulk_task_plan",
    {
      p_actor_id: actorId,
      p_plan_period: input.planPeriod,
      p_due_date: input.dueDate,
      p_reviewer_id: input.reviewerId,
      p_description: input.description,
      p_items: input.items,
      p_batch_id: input.batchId,
    },
  ),
};
