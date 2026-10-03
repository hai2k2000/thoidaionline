/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { serverSupabase } from "@/lib/serverSupabase";
import { isWorkReportEmployeeVisible, sourceForTask, sourceLabel, type WorkReportEmployee, type WorkReportSource, type WorkReportRow } from "@/lib/workReport";
type ReportFilters = { departmentId: string; employeeId?: string | null; excludeEmployeeId?: string | null; from: string; to: string; source?: WorkReportSource | null; status?: string | null; page: number; pageSize: number };

export async function getWorkReport(filters: ReportFilters) {
  const employeesResult = await serverSupabase.from("staff_users")
    .select("id,full_name,department_id,username,roles(code)")
    .eq("active", true).eq("department_id", filters.departmentId).order("full_name");
  if (employeesResult.error) return { error: employeesResult.error };
  const employees = ((employeesResult.data ?? []) as WorkReportEmployee[]).filter((employee) => isWorkReportEmployeeVisible(employee, filters.excludeEmployeeId));
  const employeeIds = employees.map((employee) => employee.id);
  if (filters.employeeId && !employeeIds.includes(filters.employeeId)) return { error: { code: "42501" } };

  const q = serverSupabase.from("tasks").select("id,title,status,workflow_type,assignment_source,department_id,start_date,due_date,completed_at,description,report_notes,report_work_date,assignee_id,owner_id,departments(name),owner:staff_users!tasks_owner_id_fkey(full_name),assignee:staff_users!tasks_assignee_id_fkey(full_name),task_assignees(user_id,assignment_role,status,staff_users(full_name))", { count: "exact" })
    .eq("department_id", filters.departmentId).neq("status", "cancelled")
    .or("start_date.lte." + filters.to + ",report_work_date.lte." + filters.to)
    .or("due_date.gte." + filters.from + ",report_work_date.gte." + filters.from);
  const result = await q.order("start_date", { ascending: false }).limit(2000);
  if (result.error) return { error: result.error };

  const rows: WorkReportRow[] = [];
  for (const task of (result.data ?? []) as any[]) {
    const source = sourceForTask(task);
    if (filters.source && filters.source !== source || filters.status && filters.status !== task.status) continue;
    const parts = [task.assignee_id, ...(task.task_assignees ?? []).filter((a: any) => a.assignment_role !== "watcher").map((a: any) => a.user_id)].filter(Boolean);
    const ids = filters.employeeId ? parts.filter((id) => id === filters.employeeId) : [...new Set(parts)].filter((id) => employeeIds.includes(id));
    for (const id of ids) {
      const participant = (task.task_assignees ?? []).find((a: any) => a.user_id === id);
      rows.push({ id: task.id, title: task.title, source, sourceLabel: sourceLabel(source), status: task.status, departmentId: task.department_id, departmentName: task.departments?.name ?? null, assigneeId: id, assigneeName: id === task.assignee_id ? task.assignee?.full_name ?? null : participant?.staff_users?.full_name ?? null, ownerName: task.owner?.full_name ?? null, reviewerName: null, startDate: task.workflow_type === "REPORT_ONLY" ? task.report_work_date : task.start_date, dueDate: task.due_date, completedAt: task.completed_at, description: task.description ?? null, reportNotes: task.report_notes ?? null, workflowType: task.workflow_type });
    }
  }
  const employeeSummaries = employees.map((employee) => {
    const employeeRows = rows.filter((row) => row.assigneeId === employee.id);
    return { ...employee, total: employeeRows.length, completed: employeeRows.filter((row) => row.status === "done").length, active: employeeRows.filter((row) => !["done", "cancelled"].includes(row.status)).length, reportOnly: employeeRows.filter((row) => row.source === "report_only").length, assigned: employeeRows.filter((row) => row.source === "assigned").length, departmentPlan: employeeRows.filter((row) => row.source === "department_plan").length };
  });
  const start = (filters.page - 1) * filters.pageSize;
  return { data: { employees: employeeSummaries, rows: rows.slice(start, start + filters.pageSize), total: rows.length, page: filters.page, pageSize: filters.pageSize }, error: null };
}
