import "server-only";
import { serverSupabase } from "@/lib/serverSupabase";
import { isSystemAdminStaff, sortStaffRows } from "@/lib/staffOrdering";

export const dutyTaskRepository = {
  async options() {
    const [people, departments] = await Promise.all([
      serverSupabase.from("staff_users").select("id,username,full_name,department_id,job_titles(code),roles(code)").eq("active", true).order("full_name"),
      serverSupabase.from("departments").select("id,code,name,manager_id").eq("active", true).neq("code", "general").order("name"),
    ]);
    if (people.error || departments.error) return { ok: false as const };
    const managerIds = new Set((departments.data ?? []).map((row) => row.manager_id).filter(Boolean));
    return { ok: true as const, people: sortStaffRows(people.data ?? []).filter((person) => !isSystemAdminStaff(person)).map((person) => ({
      id: person.id as string, username: person.username as string, full_name: person.full_name as string,
      department_id: person.department_id as string | null,
      job_title_code: (person.job_titles as { code?: string } | null)?.code ?? null,
      role_code: (person.roles as { code?: string } | null)?.code ?? null,
      is_department_manager: managerIds.has(person.id),
    })), departments: departments.data ?? [] };
  },
  async month(month: string, departmentId?: string) {
    let query = serverSupabase.from("tasks")
      .select("id,due_date,due_time,duty_position,assignee_id,department_id,reviewer_id,status,assignee:staff_users!tasks_assignee_id_fkey(full_name),duty_task_reviews(result,on_time,issue_notes,evidence_name,reviewed_at)")
      .eq("task_category", "duty").eq("duty_month", `${month}-01`).neq("status", "cancelled")
      .order("due_date").order("duty_position");
    if (departmentId) query = query.eq("department_id", departmentId);
    const { data, error } = await query;
    return error ? { ok: false as const, error } : { ok: true as const, rows: data ?? [] };
  },
  async schedule(from: string, to: string, assigneeId?: string) {
    let query = serverSupabase.from("tasks")
      .select("id,due_date,due_time,duty_position,assignee_id,reviewer_id,status,departments(name),assignee:staff_users!tasks_assignee_id_fkey(full_name),reviewer:staff_users!tasks_reviewer_id_fkey(full_name)")
      .eq("task_category", "duty").neq("status", "cancelled")
      .gte("due_date", from).lte("due_date", to).order("due_date").order("duty_position");
    if (assigneeId) query = query.eq("assignee_id", assigneeId);
    const { data, error } = await query;
    return error ? { ok: false as const, error } : { ok: true as const, rows: data ?? [] };
  },
  async isParticipant(from: string, to: string, assigneeId: string) {
    const { data, error } = await serverSupabase.from("tasks").select("id")
      .eq("task_category", "duty").neq("status", "cancelled").eq("assignee_id", assigneeId)
      .gte("due_date", from).lte("due_date", to).limit(1);
    return error ? { ok: false as const, error } : { ok: true as const, value: Boolean(data?.length) };
  },
  async summary(from: string, to: string) {
    const { data, error } = await serverSupabase.from("tasks").select("id,duty_position,assignee_id,departments(name),assignee:staff_users!tasks_assignee_id_fkey(full_name),duty_task_reviews(result,on_time,reviewed_at)").eq("task_category", "duty").neq("status", "cancelled").gte("due_date", from).lte("due_date", to).order("due_date");
    if (error) return { ok: false as const, error };
    type SummaryRow = { employeeId:string; fullName:string; department:string; positions:Set<string>; total:number; reviewed:number; completed:number; issues:number; notCompleted:number; onTime:number; late:number };
    const grouped = new Map<string, SummaryRow>();
    type SourceRow = { assignee_id:string|null; duty_position:string|null; departments:{name:string|null}|null; assignee:{full_name:string|null}|null; duty_task_reviews:{result:string;on_time:boolean}[]|{result:string;on_time:boolean}|null };
    for (const source of (data ?? []) as unknown as SourceRow[]) {
      const employeeId=source.assignee_id ?? "unassigned";
      const row=grouped.get(employeeId) ?? {employeeId,fullName:source.assignee?.full_name ?? "Chưa phân công",department:source.departments?.name ?? "—",positions:new Set<string>(),total:0,reviewed:0,completed:0,issues:0,notCompleted:0,onTime:0,late:0};
      row.total+=1; if(source.duty_position)row.positions.add(source.duty_position);
      const review=Array.isArray(source.duty_task_reviews)?source.duty_task_reviews[0]:source.duty_task_reviews;
      if(review){row.reviewed+=1;if(review.result==="completed")row.completed+=1;if(review.result==="issues")row.issues+=1;if(review.result==="not_completed")row.notCompleted+=1;if(review.on_time)row.onTime+=1;else row.late+=1;}
      grouped.set(employeeId,row);
    }
    return {ok:true as const,rows:[...grouped.values()].map(({positions,...row})=>({...row,positions:[...positions].sort()})).sort((a,b)=>a.fullName.localeCompare(b.fullName,"vi"))};
  },
  async participantReviews(from: string, to: string, assigneeId: string) {
    const { data, error } = await serverSupabase.from("tasks")
      .select("id,due_date,due_time,duty_position,status,departments(name),assignee:staff_users!tasks_assignee_id_fkey(full_name),duty_task_reviews(result,on_time,reviewed_at,evidence_name)")
      .eq("task_category", "duty").neq("status", "cancelled").eq("assignee_id", assigneeId)
      .gte("due_date", from).lte("due_date", to).order("due_date");
    return error ? { ok:false as const,error } : { ok:true as const,rows:data??[] };
  },
  async reviewDay(date: string) {
    const { data, error } = await serverSupabase.from("tasks")
      .select("id,due_date,due_time,duty_position,status,assignee:staff_users!tasks_assignee_id_fkey(full_name),departments(name),duty_task_reviews(result,on_time,issue_notes,evidence_name,reviewed_at)")
      .eq("task_category", "duty").eq("due_date", date).neq("status", "cancelled").order("duty_position");
    return error ? { ok:false as const,error } : { ok:true as const,rows:data??[] };
  },
  async save(actorId: string, input: { month: string; departmentId: string; reviewerId: string; days: { date: string; assignments: { position: string; assigneeId: string }[] }[] }) {
    const { data, error } = await serverSupabase.rpc("api_save_monthly_duty_roster", {
      p_actor: actorId, p_duty_month: `${input.month}-01`, p_department_id: input.departmentId,
      p_reviewer_id: input.reviewerId, p_days: input.days,
    });
    return error ? { ok: false as const, error } : { ok: true as const, summary: data };
  },
};
