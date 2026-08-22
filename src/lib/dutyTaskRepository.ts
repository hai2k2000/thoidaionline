import "server-only";
import { serverSupabase } from "@/lib/serverSupabase";

export const dutyTaskRepository = {
  async options() {
    const [people, departments] = await Promise.all([
      serverSupabase.from("staff_users").select("id,full_name,department_id,job_titles(code),roles(code)").eq("active", true).order("full_name"),
      serverSupabase.from("departments").select("id,name,manager_id").eq("active", true).order("name"),
    ]);
    if (people.error || departments.error) return { ok: false as const };
    const managerIds = new Set((departments.data ?? []).map((row) => row.manager_id).filter(Boolean));
    return { ok: true as const, people: (people.data ?? []).map((person) => ({
      id: person.id as string, full_name: person.full_name as string,
      department_id: person.department_id as string | null,
      job_title_code: (person.job_titles as { code?: string } | null)?.code ?? null,
      role_code: (person.roles as { code?: string } | null)?.code ?? null,
      is_department_manager: managerIds.has(person.id),
    })), departments: departments.data ?? [] };
  },
  async month(month: string, departmentId?: string) {
    let query = serverSupabase.from("tasks")
      .select("id,due_date,duty_position,assignee_id,department_id,reviewer_id,status")
      .eq("task_category", "duty").eq("duty_month", `${month}-01`).neq("status", "cancelled")
      .order("due_date").order("duty_position");
    if (departmentId) query = query.eq("department_id", departmentId);
    const { data, error } = await query;
    return error ? { ok: false as const, error } : { ok: true as const, rows: data ?? [] };
  },
  async save(actorId: string, input: { month: string; departmentId: string; reviewerId: string; days: { date: string; assignments: { position: string; assigneeId: string }[] }[] }) {
    const { data, error } = await serverSupabase.rpc("api_save_monthly_duty_roster", {
      p_actor: actorId, p_duty_month: `${input.month}-01`, p_department_id: input.departmentId,
      p_reviewer_id: input.reviewerId, p_days: input.days,
    });
    return error ? { ok: false as const, error } : { ok: true as const, summary: data };
  },
};
