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
  LegacyCreateTaskInput,
  LegacyEvaluationInput,
  LegacyUpdateTaskInput,
  RepositoryResult,
  TaskDetailDto,
  TaskListItemDto,
  TaskListQuery,
  TaskListResult,
  TaskRepository,
} from "@/lib/taskContracts";

const TASK_LIST_FIELDS = [
  "id",
  "title",
  "status",
  "task_type",
  "start_date",
  "progress_percent",
  "due_date",
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
  self_claimable: boolean;
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
  selfClaimable: row.self_claimable,
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
    if (query.status) dbQuery = dbQuery.eq("status", query.status);
    if (query.search) dbQuery = dbQuery.ilike("title", `%${query.search}%`);
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
        "id,department_id,created_by,owner_id,assignee_id,reviewer_id," +
        "self_claimable,status,task_assignees(user_id,assignment_role)",
      )
      .eq("id", taskId)
      .maybeSingle();
    if (error) return fail(error);
    return ok(data ? toAccess(data as unknown as TaskAccessRow) : null);
  },

  async detail(taskId) {
    const [taskResult, commentResult, progressResult, evaluationResult] =
      await Promise.all([
        serverSupabase
          .from("tasks")
          .select(TASK_DETAIL_FIELDS)
          .eq("id", taskId)
          .maybeSingle(),
        serverSupabase
          .from("task_comments")
          .select("id,content,created_at,user_id,staff_users(full_name)")
          .eq("task_id", taskId)
          .order("created_at", { ascending: false }),
        serverSupabase
          .from("task_progress_logs")
          .select(
            "id,old_progress,new_progress,note,created_at,user_id," +
            "staff_users!task_progress_logs_user_id_fkey(full_name)",
          )
          .eq("task_id", taskId)
          .order("created_at", { ascending: false }),
        serverSupabase
          .from("task_evaluation_checkpoints")
          .select(
            "id,task_id,employee_id,reviewer_id,rating,effort_weight," +
            "total_score,completion,on_time,opinion,checkpoint_date," +
            "is_final,created_at",
          )
          .eq("task_id", taskId)
          .order("checkpoint_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);
    const error = taskResult.error
      ?? commentResult.error
      ?? progressResult.error
      ?? evaluationResult.error;
    if (error) return fail(error);
    if (!taskResult.data) return ok(null);
    return ok({
      ...(taskResult.data as unknown as Omit<
        TaskDetailDto,
        "comments" | "progress_logs" | "legacy_evaluations"
      >),
      ...resolveTaskCompatibility(taskResult.data as unknown as TaskListItemDto),
      comments: (commentResult.data ?? []) as unknown as TaskDetailDto["comments"],
      progress_logs:
        (progressResult.data ?? []) as unknown as TaskDetailDto["progress_logs"],
      legacy_evaluations:
        (evaluationResult.data ?? []) as unknown as TaskDetailDto["legacy_evaluations"],
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

  update: (actorId, taskId, input: LegacyUpdateTaskInput) => mutation(
    "api_update_task",
    {
      p_actor_id: actorId,
      p_task_id: taskId,
      p_status: input.status ?? null,
      p_due_date: input.dueDate ?? null,
      p_update_due_date: input.dueDate !== undefined,
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
