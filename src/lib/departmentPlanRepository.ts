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

const PLAN_FIELDS = "id,department_id,period_type,period_start,period_end,created_by,created_at,updated_at";
const ITEM_FIELDS = "id,department_plan_id,department_id,title,description,requirements,due_at,assignee_id,assignment_state,work_status,linked_task_id,created_by,created_at,updated_at";
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
