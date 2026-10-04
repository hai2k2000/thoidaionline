import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";

export type DepartmentPlanRow = {
  id: string;
  department_id: string;
  period_type: "weekly" | "monthly";
  period_start: string;
  period_end: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  status?: "active" | "closed";
  closed_at?: string | null;
  closed_by?: string | null;
  close_note?: string | null;
};

export type DepartmentPlanItemRow = {
  id: string;
  department_plan_id: string;
  department_id: string;
  title: string;
  description: string | null;
  requirements: string | null;
  due_at: string | null;
  assignee_id: string | null;
  assignment_state: "unassigned" | "department_wide" | "assigned";
  work_status: "planned" | "in_progress" | "completed" | "cancelled";
  linked_task_id: string | null;
  period_relation?: "NEW" | "LONG_RUNNING" | "CARRY_OVER" | "RECURRING" | "AUTO_ADDED_DURING_PERIOD" | "IMPORTED";
  work_source?: string | null;
  period_goal?: string | null;
  period_start_state?: string | null;
  period_end_state?: string | null;
  result_this_period?: string | null;
  period_milestone_at?: string | null;
  carry_over_reason?: string | null;
  progress_start?: number | null;
  progress_end?: number | null;
  carried_from_item_id?: string | null;
  close_classification?: string | null;
  task_status_at_close?: string | null;
  completed_in_period?: boolean | null;
  carry_forward?: boolean | null;
  linked_task_status?: string | null;
  linked_task_assignees?: DepartmentPlanLinkedAssignee[];
  created_by: string;
  created_at: string;
  updated_at: string;
  created_by_name?: string | null;
};

export type DepartmentPlanLinkedAssignee = {
  user_id: string;
  assignment_role: "owner" | "assignee" | "watcher" | string;
  full_name: string | null;
};

export type DepartmentPlanLinkedTask = {
  id: string;
  title: string;
  status: string;
  department_id: string | null;
  assignee_id: string | null;
  owner_id: string | null;
  workflow_type?: string | null;
  task_assignees?: DepartmentPlanLinkedAssignee[];
};

export type DepartmentPlanItemPatch = Partial<Pick<
  DepartmentPlanItemRow,
  "title" | "description" | "requirements" | "due_at" | "assignee_id" | "assignment_state" | "work_status"
>>;

export type RepositoryResult<T> =
  | { data: T; error: null }
  | { data: T | null; error: { code?: string | null; message?: string | null } };

const PLAN_FIELDS = "id,department_id,period_type,period_start,period_end,created_by,created_at,updated_at,status,closed_at,closed_by,close_note";
const ITEM_FIELDS = "id,department_plan_id,department_id,title,description,requirements,due_at,assignee_id,assignment_state,work_status,linked_task_id,period_relation,work_source,period_goal,period_start_state,period_end_state,result_this_period,period_milestone_at,carry_over_reason,progress_start,progress_end,carried_from_item_id,close_classification,task_status_at_close,completed_in_period,carry_forward,created_by,created_at,updated_at";
const LINKED_TASK_FIELDS = "id,title,status,department_id,assignee_id,owner_id,workflow_type,task_assignees(user_id,assignment_role,status,staff_users(full_name))";
const ITEM_WITH_TASK_FIELDS = `${ITEM_FIELDS},linked_task:tasks!department_plan_items_linked_task_id_fkey(status,task_assignees(user_id,assignment_role,status,staff_users(full_name)))`;

type DepartmentPlanItemWithTask = DepartmentPlanItemRow & {
  linked_task?: { status: string; task_assignees?: RawTaskAssignee[] } | Array<{ status: string; task_assignees?: RawTaskAssignee[] }> | null;
};

type RawTaskAssignee = {
  user_id: string;
  assignment_role: string;
  staff_users?: { full_name: string | null } | Array<{ full_name: string | null }> | null;
};

const participantName = (participant: RawTaskAssignee) => {
  const staff = Array.isArray(participant.staff_users) ? participant.staff_users[0] : participant.staff_users;
  return staff?.full_name ?? null;
};

const mapParticipants = (participants: RawTaskAssignee[] | null | undefined): DepartmentPlanLinkedAssignee[] =>
  (participants ?? []).map((participant) => ({
    user_id: participant.user_id,
    assignment_role: participant.assignment_role,
    full_name: participantName(participant),
  }));

const withLinkedTaskStatus = (item: DepartmentPlanItemWithTask): DepartmentPlanItemRow => {
  const linked = Array.isArray(item.linked_task) ? item.linked_task[0] : item.linked_task;
  const row = {
    ...item,
    linked_task_status: linked?.status ?? null,
    linked_task_assignees: mapParticipants(linked?.task_assignees),
  };
  delete row.linked_task;
  return row;
};

export const departmentPlanRepository = {
  async getDepartment(departmentId: string) {
    return serverSupabase
      .from("departments")
      .select("id,name,code,manager_id")
      .eq("id", departmentId)
      .maybeSingle<{ id: string; name: string; code: string | null; manager_id: string | null }>();
  },

  async listActiveEmployees(departmentId: string) {
    return serverSupabase
      .from("staff_users")
      .select("id,full_name,department_id")
      .eq("department_id", departmentId)
      .eq("active", true)
      .order("full_name", { ascending: true });
  },

  async listImportMatchTasks(departmentId: string) {
    return serverSupabase.from("tasks")
      .select("id,title,description,due_date,status,assignee_id")
      .eq("department_id", departmentId)
      .in("status", ["new", "in_progress", "blocked", "waiting", "pending_review"])
      .order("updated_at", { ascending: false })
      .limit(100);
  },

  async listImportTasksByIds(departmentId: string, taskIds: string[]) {
    if (!taskIds.length) return { data: [], error: null };
    return serverSupabase.from("tasks")
      .select("id,title,description,due_date,status,assignee_id")
      .eq("department_id", departmentId)
      .neq("status", "cancelled")
      .in("id", taskIds);
  },

  async importItemsIntoPlan(actorId: string, planId: string, inputs: Array<Record<string, unknown>>) {
    const plan = await this.getPlan(planId);
    if (plan.error) return plan;
    if (!plan.data) return { data: null, error: { code: "P0002", message: "plan not found" } };
    if (plan.data.status === "closed") return { data: null, error: { code: "22023", message: "closed plan" } };

    const taskIds = inputs.map((input) => typeof input.taskId === "string" ? input.taskId : null).filter((id): id is string => Boolean(id));
    const taskResult = await this.listImportTasksByIds(plan.data.department_id, taskIds);
    if (taskResult.error) return { data: null, error: taskResult.error };
    const tasks = (taskResult.data ?? []) as Array<{ id: string; title: string; description: string | null; due_date: string | null; status: string; assignee_id: string | null }>;
    const existingResult = await this.listPlanItems(planId);
    if (existingResult.error) return { data: null, error: existingResult.error };
    const existing = existingResult.data ?? [];
    const normalizedTitle = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const imported: DepartmentPlanItemRow[] = [];
    const skipped: Array<{ taskId: string | null; title: string; reason: string }> = [];

    for (const input of inputs) {
      const taskId = typeof input.taskId === "string" ? input.taskId : null;
      const title = typeof input.title === "string" ? input.title.trim() : "";
      const task = taskId ? tasks.find((candidate) => candidate.id === taskId) : null;
      if (taskId && !task) return { data: null, error: { code: "42501", message: "task outside department" } };
      if (taskId && existing.some((item) => item.linked_task_id === taskId)) {
        skipped.push({ taskId, title: task?.title ?? title, reason: "already_in_plan" });
        continue;
      }
      if (!taskId && (!title || existing.some((item) => normalizedTitle(item.title) === normalizedTitle(title)))) {
        skipped.push({ taskId: null, title, reason: "already_in_plan" });
        continue;
      }
      const dueDate = typeof input.dueDate === "string" && input.dueDate ? input.dueDate : task?.due_date ?? null;
      const dueAt = typeof input.milestone === "string" && input.milestone
        ? input.milestone + "T17:00:00+07:00"
        : dueDate ? dueDate + "T17:00:00+07:00" : null;
      const workStatus = typeof input.status === "string" && ["planned", "in_progress", "completed", "cancelled"].includes(input.status)
        ? input.status
        : task?.status === "in_progress" ? "in_progress" : task?.status === "done" ? "completed" : "planned";
      const row = {
        department_plan_id: planId,
        department_id: plan.data.department_id,
        title: task?.title ?? title,
        description: task?.description ?? (typeof input.description === "string" ? input.description.trim() || null : null),
        due_at: dueAt,
        assignee_id: task?.assignee_id ?? null,
        assignment_state: task?.assignee_id ? "assigned" : "unassigned",
        work_status: workStatus,
        linked_task_id: task?.id ?? null,
        created_by: actorId,
        period_relation: typeof input.periodRelation === "string" ? input.periodRelation : "IMPORTED",
        work_source: typeof input.workSource === "string" ? input.workSource : "department_plan",
        period_milestone_at: typeof input.milestone === "string" && input.milestone ? input.milestone + "T17:00:00+07:00" : null,
        carry_over_reason: typeof input.carryOverReason === "string" ? input.carryOverReason : null,
      };
      const result = await serverSupabase.from("department_plan_items").insert(row).select(ITEM_FIELDS).single<DepartmentPlanItemRow>();
      if (result.error) {
        if (result.error.code === "23505" && task?.id) {
          skipped.push({ taskId: task.id, title: task.title, reason: "already_in_plan" });
          continue;
        }
        return { data: null, error: result.error };
      }
      imported.push(result.data);
      existing.push(result.data);
    }
    return { data: { imported, skipped }, error: null };
  },


  async validateAssignee(departmentId: string, assigneeId: string | null | undefined) {
    if (!assigneeId) return { data: true, error: null };
    const result = await serverSupabase
      .from("staff_users")
      .select("id")
      .eq("id", assigneeId)
      .eq("department_id", departmentId)
      .eq("active", true)
      .maybeSingle<{ id: string }>();
    if (result.error) return { data: false, error: result.error };
    return result.data
      ? { data: true, error: null }
      : { data: false, error: { code: "42501", message: "assignee outside department scope" } };
  },
  async getPeriod(
    departmentId: string,
    periodType: "weekly" | "monthly",
    periodStart: string,
  ) {
    return serverSupabase
      .from("department_plans")
      .select(PLAN_FIELDS)
      .eq("department_id", departmentId)
      .eq("period_type", periodType)
      .eq("period_start", periodStart)
      .maybeSingle<DepartmentPlanRow>();
  },

  async listPlanItems(planId: string) {
    const result = await serverSupabase
      .from("department_plan_items")
      .select(ITEM_WITH_TASK_FIELDS)
      .eq("department_plan_id", planId)
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (result.error) return result;
    return { data: (result.data ?? []).map((item) => withLinkedTaskStatus(item as DepartmentPlanItemWithTask)), error: null };
  },

  async getOrCreatePlanForMutation(
    departmentId: string,
    periodType: "weekly" | "monthly",
    periodStart: string,
    periodEnd: string,
    createdBy: string,
  ) {
    return serverSupabase
      .rpc("api_get_or_create_department_plan", {
        p_department_id: departmentId,
        p_period_type: periodType,
        p_period_start: periodStart,
        p_period_end: periodEnd,
        p_created_by: createdBy,
      })
      .single<DepartmentPlanRow>();
  },

  async candidates(actorId: string, departmentId: string, periodType: "weekly" | "monthly", periodStart: string, periodEnd: string) {
    return serverSupabase.rpc("api_department_plan_candidates_v2", { p_actor_id: actorId, p_department_id: departmentId, p_period_type: periodType, p_period_start: periodStart, p_period_end: periodEnd }).single<unknown[]>();
  },

  async createPlanV2(actorId: string, departmentId: string, periodType: "weekly" | "monthly", periodStart: string, periodEnd: string, items: unknown[]) {
    return serverSupabase.rpc("api_create_department_plan_v2", { p_actor_id: actorId, p_department_id: departmentId, p_period_type: periodType, p_period_start: periodStart, p_period_end: periodEnd, p_items: items }).single<DepartmentPlanRow>();
  },

  async createPlanV2Result(actorId: string, departmentId: string, periodType: "weekly" | "monthly", periodStart: string, periodEnd: string, items: unknown[]) {
    return serverSupabase.rpc("api_create_department_plan_v2_result", { p_actor_id: actorId, p_department_id: departmentId, p_period_type: periodType, p_period_start: periodStart, p_period_end: periodEnd, p_items: items }).single<{ plan: DepartmentPlanRow; created: boolean }>();
  },

  async closePlan(actorId: string, planId: string, decisions: unknown[], closeNote: string | null) {
    return serverSupabase.rpc("api_close_department_plan_v2", { p_actor_id: actorId, p_plan_id: planId, p_decisions: decisions, p_close_note: closeNote }).single<DepartmentPlanRow>();
  },

  async getPlan(planId: string) {
    return serverSupabase
      .from("department_plans")
      .select(PLAN_FIELDS)
      .eq("id", planId)
      .maybeSingle<DepartmentPlanRow>();
  },

  async getItem(itemId: string) {
    const result = await serverSupabase
      .from("department_plan_items")
      .select(ITEM_FIELDS)
      .eq("id", itemId)
      .maybeSingle<DepartmentPlanItemRow>();
    if (result.error || !result.data) return result;
    const creator = await serverSupabase
      .from("staff_users")
      .select("full_name")
      .eq("id", result.data.created_by)
      .maybeSingle<{ full_name: string }>();
    if (creator.error) return { data: null, error: creator.error };
    return { data: { ...result.data, created_by_name: creator.data?.full_name ?? null }, error: null };
  },

  async createItem(
    planId: string,
    actorId: string,
    input: Omit<DepartmentPlanItemPatch, "linked_task_id"> & { title: string },
  ) {
    const plan = await this.getPlan(planId);
    if (plan.error) return plan;
    if (!plan.data) return { data: null, error: { code: "P0002", message: "plan not found" } };
    return serverSupabase
      .from("department_plan_items")
      .insert({
        department_plan_id: plan.data.id,
        department_id: plan.data.department_id,
        created_by: actorId,
        title: input.title,
        description: input.description ?? null,
        requirements: input.requirements ?? null,
        due_at: input.due_at ?? null,
        // Generic saves are Plan-only. Explicit assignment goes through the
        // transactional RPC and is the only path that writes assignee_id.
        assignee_id: null,
        assignment_state: input.assignment_state === "department_wide" ? "department_wide" : "unassigned",
        work_status: input.work_status ?? "planned",
      })
      .select(ITEM_FIELDS)
      .single<DepartmentPlanItemRow>();
  },

  async updateItem(itemId: string, patch: DepartmentPlanItemPatch) {
    const safePatch = {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.requirements !== undefined ? { requirements: patch.requirements } : {}),
      ...(patch.due_at !== undefined ? { due_at: patch.due_at } : {}),
      ...(patch.work_status !== undefined ? { work_status: patch.work_status } : {}),
      ...(patch.assignment_state === "department_wide" ? { assignment_state: "department_wide", assignee_id: null } : {}),
      ...(patch.assignment_state === "unassigned" ? { assignment_state: "unassigned", assignee_id: null } : {}),
    };
    return serverSupabase
      .from("department_plan_items")
      .update({ ...safePatch, updated_at: new Date().toISOString() })
      .eq("id", itemId)
      .select(ITEM_FIELDS)
      .maybeSingle<DepartmentPlanItemRow>();
  },

  async deleteItem(itemId: string) {
    return serverSupabase
      .from("department_plan_items")
      .delete()
      .eq("id", itemId)
      .select("id")
      .maybeSingle<{ id: string }>();
  },

  async getLinkedTask(itemId: string) {
    const item = await this.getItem(itemId);
    if (item.error) return item;
    if (!item.data?.linked_task_id) return { data: null, error: null };
    return serverSupabase
      .from("tasks")
      .select(LINKED_TASK_FIELDS)
      .eq("id", item.data.linked_task_id)
      .maybeSingle<DepartmentPlanLinkedTask & { task_assignees?: RawTaskAssignee[] }>()
      .then((result) => result.error || !result.data
        ? result
        : { data: { ...result.data, task_assignees: mapParticipants(result.data.task_assignees) }, error: null });
  },

  async assignTaskFromItem(actorId: string, itemId: string, input: Record<string, unknown>) {
    return serverSupabase
      .rpc("api_assign_department_plan_task_v2", {
        p_actor_id: actorId,
        p_item_id: itemId,
        p_input: input,
      })
      .single<DepartmentPlanLinkedTask>();
  },

  async quickAssignTaskFromItem(actorId: string, itemId: string, input: {
    assigneeIds: string[];
    dueDate: string;
    dueTime: string;
    priority: "low" | "normal" | "high" | "urgent";
    note: string | null;
  }) {
    return serverSupabase
      .rpc("api_assign_department_plan_task_v2", {
        p_actor_id: actorId,
        p_item_id: itemId,
        p_input: {
          assigneeIds: input.assigneeIds,
          dueDate: input.dueDate,
          dueTime: input.dueTime,
          priority: input.priority,
          note: input.note,
        },
      })
      .single<DepartmentPlanLinkedTask>();
  },

  // Kept for older callers while new compact assignment uses the V2 array.
  async quickAssignTaskFromItemLegacy(actorId: string, itemId: string, input: {
    assigneeId: string;
    dueDate: string;
    dueTime: string;
    priority: "low" | "normal" | "high" | "urgent";
    note: string | null;
  }) {
    return serverSupabase.rpc("api_quick_assign_department_plan_task_v1", {
      p_actor_id: actorId,
      p_item_id: itemId,
      p_assignee_id: input.assigneeId,
      p_due_date: input.dueDate,
      p_due_time: input.dueTime,
      p_priority: input.priority,
      p_note: input.note,
    }).single<DepartmentPlanLinkedTask>();
  },

  async createAndAssignItem(actorId: string, planId: string, input: Record<string, unknown>) {
    return serverSupabase
      .rpc("api_create_department_plan_task_v2", {
        p_actor_id: actorId,
        p_plan_id: planId,
        p_input: input,
      })
      .single<{ task: DepartmentPlanLinkedTask; item: DepartmentPlanItemRow }>();
  },

  async createTaskFromItem(actorId: string, itemId: string) {
    return serverSupabase
      .rpc("api_create_department_plan_task", {
        p_actor_id: actorId,
        p_item_id: itemId,
      })
      .single<DepartmentPlanLinkedTask>();
  },
};
