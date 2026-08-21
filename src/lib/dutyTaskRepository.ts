import "server-only";
import { serverSupabase } from "@/lib/serverSupabase";

export const dutyTaskRepository = {
  async options() {
    const result = await serverSupabase.from("staff_users").select("id,full_name,department_id,job_titles(code)").eq("active", true).order("full_name");
    const departments = await serverSupabase.from("departments").select("id,name,manager_id").eq("active", true).order("name");
    if (result.error || departments.error) return { ok: false as const };
    return { ok: true as const, people: (result.data ?? []).map((person) => ({ ...person, job_title_code: (person.job_titles as { code?: string } | null)?.code ?? null })), departments: departments.data ?? [] };
  },
  async create(actorId: string, input: { title: string; description: string; departmentId: string; assigneeId: string; reviewerId: string; dueDate: string; dueTime: string; dutyMonth: string; dutyPosition: string }) {
    const { data, error } = await serverSupabase.rpc("api_create_duty_task", {
      p_actor: actorId,
      p_title: input.title,
      p_description: input.description,
      p_department_id: input.departmentId,
      p_assignee_id: input.assigneeId,
      p_reviewer_id: input.reviewerId,
      p_due_date: input.dueDate,
      p_due_time: input.dueTime,
      p_duty_month: `${input.dutyMonth}-01`,
      p_duty_position: input.dutyPosition,
    });
    return error ? { ok: false as const, error } : { ok: true as const, id: data as string };
  },
};
