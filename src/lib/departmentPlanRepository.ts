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
  created_by: string;
  created_at: string;
  updated_at: string;
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

export const departmentPlanRepository = {
  async getDepartment(departmentId: string) {
    return serverSupabase
      .from("departments")
      .select("id,name")
      .eq("id", departmentId)
      .maybeSingle<{ id: string; name: string }>();
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
    return serverSupabase
      .from("department_plan_items")
      .select(ITEM_FIELDS)
      .eq("department_plan_id", planId)
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
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
    return serverSupabase
      .from("department_plan_items")
      .select(ITEM_FIELDS)
      .eq("id", itemId)
      .maybeSingle<DepartmentPlanItemRow>();
  },

  async createItem(
    planId: string,
    actorId: string,
    input: Omit<DepartmentPlanItemPatch, "linked_task_id"> & { title: string },
  ) {
    const plan = await this.getPlan(planId);
    if (plan.error) return plan;
    if (!plan.data) return { data: null, error: { code: "P0002", message: "plan not found" } };
    const assignee = await this.validateAssignee(plan.data.department_id, input.assignee_id);
    if (assignee.error) return { data: null, error: assignee.error };
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
        assignee_id: input.assignee_id ?? null,
        assignment_state: input.assignment_state ?? "unassigned",
        work_status: input.work_status ?? "planned",
      })
      .select(ITEM_FIELDS)
      .single<DepartmentPlanItemRow>();
  },

  async updateItem(itemId: string, patch: DepartmentPlanItemPatch) {
    if (patch.assignee_id !== undefined) {
      const current = await this.getItem(itemId);
      if (current.error) return current;
      if (!current.data) return { data: null, error: { code: "P0002", message: "item not found" } };
      const assignee = await this.validateAssignee(current.data.department_id, patch.assignee_id);
      if (assignee.error) return { data: null, error: assignee.error };
    }
    return serverSupabase
      .from("department_plan_items")
      .update({ ...patch, updated_at: new Date().toISOString() })
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
      .select("id,title,status,department_id,assignee_id,owner_id")
      .eq("id", item.data.linked_task_id)
      .maybeSingle();
  },
};
