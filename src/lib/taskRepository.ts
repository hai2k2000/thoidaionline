import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";
import {
  hasOrganizationTaskView,
  type AuthorizationActor,
  type TaskAccessSnapshot,
  type TaskParticipant,
} from "@/lib/authorization";
import { resolveTaskCompatibility } from "@/lib/taskCompatibility";
import { isTaskRbacV2Enabled } from "@/lib/taskRbacFlag";
import { buildTaskListScope } from "@/lib/taskAuthorization";
import { loadRbacActor } from "@/lib/rbac/repository";
import { applyJournalismExcludeFilter } from "@/lib/taskFilters.mjs";
import { publicationReportDto } from "@/lib/journalismManualPublicationValidation";
import type {
  AssignedTaskInput,
  LegacyCreateTaskInput,
  LegacyEvaluationInput,
  LegacyUpdateTaskInput,
  PersonalTaskEditInput,
  PersonalTaskInput,
  TaskAssignmentBatchResult,
  RepositoryResult,
  JournalismTaskDetailDto,
  JournalismTaskListSummaryDto,
  JournalismSeriesDto,
  JournalismTopicDto,
  TaskDetailDto,
  TaskListItemDto,
  TaskRepository,
  TaskWorkflowContextDto,
} from "@/lib/taskContracts";

const TASK_BASE_FIELDS = [
  "id",
  "title",
  "priority",
  "created_at",
  "status",
  "approval_required",
  "assignment_source",
  "assignment_approved_by",
  "assignment_approved_at",
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
  "description",
  "attachment_url",
  "evaluation_criteria",
  "departments(name)",
  "task_assignees(user_id,assignment_role,status,staff_users(full_name))",
  "created_by_user:staff_users!tasks_created_by_fkey(full_name)",
  "assignment_approver:staff_users!tasks_assignment_approved_by_fkey(full_name)",
  "completion_score:task_completion_scores(requirement_score,collaboration_score,initiative_score,total_score,note)",
];

const journalismListFields = (
  inner = false,
  topicInner = false,
  seriesInner = false,
) => [
  ...TASK_BASE_FIELDS,
  `journalism:journalism_task_details${inner ? "!inner" : ""}(publication_status,planned_publication_at,published_at,work_kind:journalism_work_kinds(id,code,name,is_active)${topicInner ? ",topic_filter:editorial_topic_tasks!inner(topic_id)" : ""}${seriesInner ? ",series_filter:editorial_series_items!inner(series_id)" : ""})`,
].join(",");

const TASK_LIST_FIELDS = journalismListFields();
// Keep a minimal relation embedded so PostgREST can exclude Journalism rows
// for actors outside the approved Journalism scope.
const NON_JOURNALISM_TASK_FIELDS = [
  ...TASK_BASE_FIELDS,
  "journalism:journalism_task_details!left(task_id)",
].join(",");

const TASK_DETAIL_FIELDS = [
  ...TASK_BASE_FIELDS,
  "description",
  "effort_weight",
  "evaluation_criteria",
  "owner:staff_users!tasks_owner_id_fkey(full_name)",
  "reviewer:staff_users!tasks_reviewer_id_fkey(full_name)",
  "journalism:journalism_task_details(task_id,publication_status,planned_publication_at,published_at,location,article_url,editorial_notes,created_at,updated_at,work_kind:journalism_work_kinds(id,code,name,description,is_active,sort_order),topic_links:editorial_topic_tasks(topic:editorial_topics(id,name,is_active,department_id)),series_links:editorial_series_items(task_id,position,series:editorial_series(id,name,is_active,department_id,topic_id)),publication_report:journalism_publication_reports(id,task_id,publication_url,published_title,published_at,note,reported_by,created_at,updated_at,reporter:staff_users!journalism_publication_reports_reported_by_fkey(full_name),verification_history:journalism_publication_verifications(id,publication_report_id,decision,note,verified_by,publication_report_updated_at,created_at,verifier:staff_users!journalism_publication_verifications_verified_by_fkey(full_name))))",
].join(",");

const journalismValue = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

const withJournalismList = (item: TaskListItemDto): TaskListItemDto => ({
  ...item,
  journalism: journalismValue(
    item.journalism as JournalismTaskListSummaryDto | JournalismTaskListSummaryDto[] | null,
  ),
});

type SeriesMembershipRow = {
  task_id: string;
  position: number;
  series: {
    id: string;
    name: string;
    is_active: boolean;
    department_id: string | null;
    topic_id: string | null;
  } | null;
};

const seriesDto = (row: SeriesMembershipRow | undefined): JournalismSeriesDto | null =>
  row?.series ? {
    id: row.series.id,
    name: row.series.name,
    isActive: row.series.is_active,
    departmentId: row.series.department_id,
    topicId: row.series.topic_id,
    position: row.position,
  } : null;

const enrichJournalismList = async (
  items: TaskListItemDto[],
): Promise<RepositoryResult<TaskListItemDto[]>> => {
  const journalismIds = items.filter((item) => item.journalism).map((item) => item.id);
  if (journalismIds.length === 0) return ok(items);
  const [topicResult, seriesResult] = await Promise.all([
    serverSupabase.from("editorial_topic_tasks").select("task_id").in("task_id", journalismIds),
    serverSupabase.from("editorial_series_items")
      .select("task_id,position,series:editorial_series(id,name,is_active,department_id,topic_id)")
      .in("task_id", journalismIds),
  ]);
  const error = topicResult.error ?? seriesResult.error;
  if (error) return fail(error);
  const topicCounts = new Map<string, number>();
  for (const row of topicResult.data ?? []) {
    const taskId = row.task_id as string;
    topicCounts.set(taskId, (topicCounts.get(taskId) ?? 0) + 1);
  }
  const seriesByTask = new Map(
    ((seriesResult.data ?? []) as unknown as SeriesMembershipRow[])
      .map((row) => [row.task_id, row] as const),
  );
  return ok(items.map((item) => item.journalism ? {
    ...item,
    journalism: {
      ...item.journalism,
      topicCount: topicCounts.get(item.id) ?? 0,
      series: seriesDto(seriesByTask.get(item.id)),
    },
  } : item));
};

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
  approval_required: boolean;
  task_assignees: {
    user_id: string;
    assignment_role: TaskParticipant["assignmentRole"];
  }[] | null;
};

type TaskStatusEventRow = {
  task_id: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  actor_id: string;
  created_at: string;
};

type TaskAuditLogRow = {
  entity_id: string;
  action: string;
  actor_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

type StaffNameRow = { id: string; full_name: string | null };

const APPROVAL_AUDIT_ACTIONS = [
  "create",
  "submit_assignment_approval",
  "approve_assignment",
  "reject_assignment",
  "submit_completion",
  "approve_completion",
  "request_rework",
] as const;

const approvalActionLabel = (action: string) => ({
  create: "Tạo công việc",
  submit_assignment_approval: "Gửi duyệt giao việc",
  approve_assignment: "Duyệt giao việc",
  reject_assignment: "Từ chối giao việc",
  submit_completion: "Gửi duyệt hoàn thành",
  approve_completion: "Duyệt hoàn thành",
  request_rework: "Yêu cầu làm lại",
}[action] ?? action);

const statusEventApprovalAction = (event: TaskStatusEventRow) => {
  if (event.to_status === "waiting") return "submit_assignment_approval";
  if (event.from_status === "waiting" && event.to_status === "in_progress") return "approve_assignment";
  if (event.from_status === "waiting" && event.to_status === "rejected") return "reject_assignment";
  if (event.to_status === "pending_review") return "submit_completion";
  if (event.from_status === "pending_review" && event.to_status === "done") return "approve_completion";
  if (event.from_status === "pending_review" && event.to_status === "in_progress") return "request_rework";
  return null;
};

const auditReason = (row: TaskAuditLogRow) => {
  const reason = row.new_data?.reason ?? row.old_data?.reason;
  return typeof reason === "string" && reason.trim() ? reason : null;
};

const enrichApprovalWorkflowContext = async (
  items: TaskListItemDto[],
): Promise<RepositoryResult<TaskListItemDto[]>> => {
  if (items.length === 0) return ok(items);
  const taskIds = items.map((item) => item.id);
  const [statusResult, auditResult] = await Promise.all([
    serverSupabase
      .from("task_status_events")
      .select("task_id,from_status,to_status,reason,actor_id,created_at")
      .in("task_id", taskIds)
      .order("created_at", { ascending: false })
      .limit(500),
    serverSupabase
      .from("audit_logs")
      .select("entity_id,action,actor_id,old_data,new_data,created_at")
      .eq("module", "task")
      .eq("entity_type", "tasks")
      .in("entity_id", taskIds)
      .in("action", Array.from(APPROVAL_AUDIT_ACTIONS))
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  const error = statusResult.error ?? auditResult.error;
  if (error) return fail(error);
  const statusEvents = (statusResult.data ?? []) as unknown as TaskStatusEventRow[];
  const auditLogs = (auditResult.data ?? []) as unknown as TaskAuditLogRow[];
  const actorIds = [...new Set([
    ...statusEvents.map((event) => event.actor_id),
    ...auditLogs.map((event) => event.actor_id).filter((id): id is string => Boolean(id)),
  ])];
  const actorResult = actorIds.length
    ? await serverSupabase.from("staff_users").select("id,full_name").in("id", actorIds)
    : { data: [], error: null };
  if (actorResult.error) return fail(actorResult.error);
  const actorNames = new Map(
    ((actorResult.data ?? []) as unknown as StaffNameRow[]).map((row) => [row.id, row.full_name] as const),
  );
  type Candidate = TaskWorkflowContextDto & { priority: number };
  const candidates = new Map<string, Candidate>();
  const consider = (taskId: string, candidate: Candidate) => {
    const current = candidates.get(taskId);
    if (!current || candidate.created_at > current.created_at
      || (candidate.created_at === current.created_at && candidate.priority > current.priority)) {
      candidates.set(taskId, candidate);
    }
  };
  for (const event of statusEvents) {
    const action = statusEventApprovalAction(event);
    if (!action) continue;
    consider(event.task_id, {
      action,
      label: approvalActionLabel(action),
      reason: event.reason,
      actor_id: event.actor_id,
      actor_name: actorNames.get(event.actor_id) ?? null,
      created_at: event.created_at,
      source: "task_status_events",
      priority: 1,
    });
  }
  for (const event of auditLogs) {
    if (!APPROVAL_AUDIT_ACTIONS.includes(event.action as typeof APPROVAL_AUDIT_ACTIONS[number])) continue;
    consider(event.entity_id, {
      action: event.action,
      label: approvalActionLabel(event.action),
      reason: auditReason(event),
      actor_id: event.actor_id,
      actor_name: event.actor_id ? actorNames.get(event.actor_id) ?? null : null,
      created_at: event.created_at,
      source: "audit_logs",
      priority: event.action === "create" ? 0 : 2,
    });
  }
  return ok(items.map((item) => ({
    ...item,
    recent_workflow_event: candidates.get(item.id) ?? null,
  })));
};

const ok = <T>(data: T): RepositoryResult<T> => ({ ok: true, data });
export const isTaskListRangeExhausted = (error: { code?: string | null } | null | undefined) =>
  error?.code === "PGRST103";

const fail = <T>(error: { code?: string | null }): RepositoryResult<T> => ({
  ok: false,
  error: { code: error.code ?? null },
});

export type JournalismWorkKindOption = { id: string; name: string; is_active: boolean };

export async function listJournalismWorkKinds(selectedId: string | null = null): Promise<RepositoryResult<JournalismWorkKindOption[]>> {
  const activeResult = await serverSupabase
    .from("journalism_work_kinds")
    .select("id,name,is_active,sort_order")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (activeResult.error) return fail(activeResult.error);
  const options = (activeResult.data ?? []) as JournalismWorkKindOption[];
  if (!selectedId || options.some((option) => option.id === selectedId)) return ok(options);
  const historicalResult = await serverSupabase
    .from("journalism_work_kinds")
    .select("id,name,is_active,sort_order")
    .eq("id", selectedId)
    .maybeSingle();
  if (historicalResult.error) return fail(historicalResult.error);
  return historicalResult.data
    ? ok([...options, historicalResult.data as JournalismWorkKindOption])
    : ok(options);
}

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
  approvalRequired: row.approval_required,
  participants: (row.task_assignees ?? []).map((participant) => ({
    userId: participant.user_id,
    assignmentRole: participant.assignment_role,
  })),
});

export const getTaskScopeTerms = async (
  actor: AuthorizationActor,
): Promise<RepositoryResult<string[]>> => {
  if (isTaskRbacV2Enabled()) {
    const rbacActor = await loadRbacActor({ id: actor.id, department_id: actor.departmentId });
    const assignments = await serverSupabase
      .from("task_assignees")
      .select("task_id")
      .eq("user_id", actor.id);
    if (assignments.error) return fail(assignments.error);
    const scope = buildTaskListScope(
      rbacActor,
      (assignments.data ?? []).map((row) => row.task_id as string),
    );
    if (scope.all) return ok([]);
    if (scope.terms.length === 0) return ok(["id.eq.00000000-0000-0000-0000-000000000000"]);
    return ok(scope.terms);
  }
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
    const hasJournalismSubfilter = Boolean(
      query.journalismWorkKindId
      || query.publicationStatus
      || query.plannedPublicationFrom
      || query.plannedPublicationTo
      || query.topicId
      || query.seriesId,
    );
    const journalismOnly = query.journalism === "only" || hasJournalismSubfilter;
    if (journalismOnly && actor.canAccessJournalism === false) {
      return fail({ code: "42501" });
    }
    const scope = await getTaskScopeTerms(actor);
    if (!scope.ok) return scope;

    let dbQuery = serverSupabase
      .from("tasks")
      .select(
        journalismOnly
          ? journalismListFields(true, Boolean(query.topicId), Boolean(query.seriesId))
          : actor.canAccessJournalism === false ? NON_JOURNALISM_TASK_FIELDS : TASK_LIST_FIELDS,
        { count: "exact" },
      )
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
    else dbQuery = dbQuery.neq("task_category", "duty");
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
    if (query.assignmentSource) dbQuery = dbQuery.eq("assignment_source", query.assignmentSource);
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
    if (!journalismOnly || actor.canAccessJournalism === false) {
      dbQuery = applyJournalismExcludeFilter(dbQuery);
    }
    if (query.journalismWorkKindId) {
      dbQuery = dbQuery.eq("journalism_task_details.work_kind_id", query.journalismWorkKindId);
    }
    if (query.publicationStatus) {
      dbQuery = dbQuery.eq("journalism_task_details.publication_status", query.publicationStatus);
    }
    if (query.plannedPublicationFrom) {
      dbQuery = dbQuery.gte(
        "journalism_task_details.planned_publication_at",
        `${query.plannedPublicationFrom}T00:00:00+07:00`,
      );
    }
    if (query.plannedPublicationTo) {
      dbQuery = dbQuery.lte(
        "journalism_task_details.planned_publication_at",
        `${query.plannedPublicationTo}T23:59:59.999+07:00`,
      );
    }
    if (query.topicId) dbQuery = dbQuery.eq("journalism_task_details.topic_filter.topic_id", query.topicId);
    if (query.seriesId) dbQuery = dbQuery.eq("journalism_task_details.series_filter.series_id", query.seriesId);
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
    if (isTaskListRangeExhausted(error)) {
      return ok({ items: [], total: count ?? 0, page: query.page, pageSize: query.pageSize });
    }
    if (error) return fail(error);
    const normalizedItems = ((data ?? []) as unknown as TaskListItemDto[]).map((item) => {
        const normalized = withJournalismList(item);
        return { ...normalized, ...resolveTaskCompatibility(normalized) };
      });
    const enriched = await enrichJournalismList(normalizedItems);
    if (!enriched.ok) return enriched;
    return ok({
      items: enriched.data,
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
        "self_claimable,task_type,status,approval_required,task_assignees(user_id,assignment_role)",
      )
      .eq("id", taskId)
      .maybeSingle();
    if (error) return fail(error);
    return ok(data ? toAccess(data as unknown as TaskAccessRow) : null);
  },

  async listApprovalQueue(actor, queue) {
    const global = ["admin", "tong_bien_tap", "pho_tong_bien_tap"].includes(actor.roleCode);
    if (!global && (!actor.isDepartmentManager || !actor.departmentId)) {
      return fail({ code: "42501" });
    }
    let query = serverSupabase.from("tasks").select(TASK_LIST_FIELDS, { count: "exact" })
      .eq("approval_required", true)
      .eq("status", queue === "assignment" ? "waiting" : "pending_review")
      .neq("task_category", "duty")
      .order("created_at", { ascending: false });
    if (!global) query = query.eq("department_id", actor.departmentId!);
    if (actor.canAccessJournalism === false) query = applyJournalismExcludeFilter(query);
    const { data, error, count } = await query.range(0, 99);
    if (error) return fail(error);
    const items = ((data ?? []) as unknown as TaskListItemDto[]).map((item) => ({
      ...resolveTaskCompatibility(withJournalismList(item)),
      ...withJournalismList(item),
    }));
    const enriched = await enrichApprovalWorkflowContext(items);
    if (!enriched.ok) return enriched;
    return ok({ items: enriched.data, total: count ?? items.length, page: 1, pageSize: 100 });
  },

  async detail(taskId, actor) {
    const journalismScopeResult = actor?.canAccessJournalism === false
      ? await serverSupabase.from("journalism_task_details").select("task_id").eq("task_id", taskId).maybeSingle()
      : null;
    const isJournalism = Boolean(journalismScopeResult?.data);
    if (journalismScopeResult?.error) return fail(journalismScopeResult.error);
    if (isJournalism) return ok(null);
    const [taskResult, commentResult, legacyProgressResult, evaluationResult,
      progressResult, qualitativeEvaluationResult, deadlineResult, statusResult,
      attachmentResult, completionScoreResult] = await Promise.all([
      serverSupabase.from("tasks").select(actor?.canAccessJournalism === false ? TASK_BASE_FIELDS.concat(["effort_weight", "owner:staff_users!tasks_owner_id_fkey(full_name)", "reviewer:staff_users!tasks_reviewer_id_fkey(full_name)"]).join(",") : TASK_DETAIL_FIELDS).eq("id", taskId).maybeSingle(),
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
      serverSupabase.from("task_completion_scores")
        .select("id,requirement_results,requirement_score,collaboration_score,initiative_score,total_score,note,created_at,reviewer:staff_users!task_completion_scores_reviewer_id_fkey(full_name)")
        .eq("task_id", taskId).maybeSingle(),
    ]);
    const error = taskResult.error ?? commentResult.error ?? legacyProgressResult.error
      ?? evaluationResult.error ?? progressResult.error ?? qualitativeEvaluationResult.error
      ?? deadlineResult.error
      ?? statusResult.error ?? attachmentResult.error ?? completionScoreResult.error;
    if (error) return fail(error);
    if (!taskResult.data) return ok(null);
    return ok({
      ...(taskResult.data as unknown as Omit<TaskDetailDto,
        "comments" | "progress_logs" | "legacy_evaluations" | "progress_reports"
        | "qualitative_evaluations"
        | "deadline_history" | "status_events" | "attachments" | "completion_score">),
      ...resolveTaskCompatibility(taskResult.data as unknown as TaskListItemDto),
      comments: (commentResult.data ?? []) as unknown as TaskDetailDto["comments"],
      progress_logs: (legacyProgressResult.data ?? []) as unknown as TaskDetailDto["progress_logs"],
      legacy_evaluations: (evaluationResult.data ?? []) as unknown as TaskDetailDto["legacy_evaluations"],
      progress_reports: (progressResult.data ?? []) as unknown as TaskDetailDto["progress_reports"],
      qualitative_evaluations: (qualitativeEvaluationResult.data ?? []) as unknown as TaskDetailDto["qualitative_evaluations"],
      deadline_history: (deadlineResult.data ?? []) as unknown as TaskDetailDto["deadline_history"],
      status_events: (statusResult.data ?? []) as unknown as TaskDetailDto["status_events"],
      attachments: (attachmentResult.data ?? []) as unknown as TaskDetailDto["attachments"],
      completion_score: completionScoreResult.data as unknown as TaskDetailDto["completion_score"],
      journalism: (() => {
        const journalism = journalismValue(
          (taskResult.data as unknown as { journalism?: JournalismTaskDetailDto | JournalismTaskDetailDto[] | null }).journalism,
        );
        if (!journalism) return null;
        const detail = taskResult.data as unknown as { journalism?: JournalismTaskDetailDto & {
          topic_links?: Array<{ topic?: object | object[] | null }>;
          series_links?: Array<SeriesMembershipRow>;
          publication_report?: object | object[] | null;
        } | JournalismTaskDetailDto[] | null };
        const rawJournalism = journalismValue(detail.journalism) as unknown as (JournalismTaskDetailDto & {
          topic_links?: Array<{ topic?: object | object[] | null }>;
          series_links?: Array<SeriesMembershipRow>;
          publication_report?: object | object[] | null;
        }) | null;
        const topics = (rawJournalism?.topic_links ?? []).flatMap((row) => {
          const topic = journalismValue(row.topic as unknown as {
            id: string; name: string; is_active: boolean; department_id: string | null;
          } | Array<{ id: string; name: string; is_active: boolean; department_id: string | null }> | null);
          return topic ? [{
            id: topic.id,
            name: topic.name,
            isActive: topic.is_active,
            departmentId: topic.department_id,
          } satisfies JournalismTopicDto] : [];
        }).sort((left, right) => left.name.localeCompare(right.name, "vi", { sensitivity: "base" })
          || left.id.localeCompare(right.id));
        const baseJournalism = { ...(rawJournalism as unknown as Record<string, unknown>) };
        delete baseJournalism.topic_links;
        delete baseJournalism.series_links;
        delete baseJournalism.publication_report;
        return {
          ...baseJournalism,
          topicCount: topics.length,
          topics,
          series: seriesDto(rawJournalism?.series_links?.[0]),
          publication_report: publicationReportDto(
            journalismValue(rawJournalism?.publication_report as object | object[] | null | undefined),
          ),
        } as unknown as JournalismTaskDetailDto;
      })(),
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

  assignBatch: async (actorId, input) => {
    const result = await mutation<TaskAssignmentBatchResult>(
      "api_assign_task_batch_v1",
      {
        p_actor_id: actorId,
        p_batch_id: input.batchId,
        p_department_id: input.departmentId,
        p_assignee_id: input.assigneeId,
        p_tasks: input.tasks.map((task) => ({
          title: task.title,
          description: task.description,
          due_date: task.dueDate,
          due_time: task.dueTime,
          evaluation_criteria: task.evaluationCriteria,
          priority: task.priority,
          collaborator_ids: task.collaboratorIds,
          watcher_ids: task.watcherIds,
          recurrence_frequency: task.recurrenceFrequency,
          recurrence_ends_on: task.recurrenceEndsOn,
        })),
      },
    );
    if (!result.ok) return result;
    return ok({
      batchId: result.data.batchId,
      tasks: result.data.tasks,
      count: result.data.count,
      replayed: result.data.replayed,
    });
  },

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
  scoreTaskCompletion: (actorId, taskId, requirementResults, requirementScore, collaborationScore, initiativeScore, note) => mutation(
    "api_score_task_completion",
    { p_actor_id: actorId, p_task_id: taskId, p_requirement_results: requirementResults, p_requirement_score: requirementScore, p_collaboration_score: collaborationScore, p_initiative_score: initiativeScore, p_note: note },
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
