import { apiError, apiJson, requireReadActor } from "@/lib/serverApi";
import { taskRepository } from "@/lib/taskRepository";
import { serverSupabase } from "@/lib/serverSupabase";

export async function GET() {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const actor = {
    id: guard.actor.id,
    departmentId: guard.actor.department_id,
    roleCode: guard.actor.role_code,
    roleLevel: guard.actor.role_level,
    permissions: guard.actor.permissions,
  };
  const taskResult = await taskRepository.list(actor, {
    search: null, scope: "all", taskType: null, status: null, statusGroup: null,
    fromDate: null, toDate: null, deadlineState: null, departmentId: null,
    page: 1, pageSize: 300,
  });
  if (!taskResult.ok) return apiError("operation_failed", 500);
  const today = new Date().toISOString().slice(0, 10);
  const organizationMetrics = guard.actor.role_code === "admin"
    ? await Promise.all([
      serverSupabase.from("employee_profiles").select("*", { count: "exact", head: true }),
      serverSupabase.from("assets").select("*", { count: "exact", head: true }).eq("status", "in_use"),
      serverSupabase.from("official_documents").select("*", { count: "exact", head: true }).lte("processing_deadline", today).neq("status", "done"),
    ])
    : null;
  if (organizationMetrics?.some((result) => result.error)) return apiError("operation_failed", 500);
  const tasks = taskResult.data.items;
  return apiJson({
    totalTasks: taskResult.data.total,
    myTasks: tasks.filter((task) => task.assignee_id === actor.id || task.task_assignees.some((item) => item.user_id === actor.id)).length,
    overdueTasks: tasks.filter((task) => task.due_date && task.due_date < today && task.status !== "done").length,
    hrProfiles: organizationMetrics?.[0].count ?? 0,
    assetsInUse: organizationMetrics?.[1].count ?? 0,
    documentsOverdue: organizationMetrics?.[2].count ?? 0,
  });
}
