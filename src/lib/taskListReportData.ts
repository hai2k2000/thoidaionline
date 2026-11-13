import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";
import { loadLatestTaskProgressReports, taskRepository } from "@/lib/taskRepository";
import { apiError, rpcFailure } from "@/lib/serverApi";
import { canUseJournalism } from "@/lib/journalismScope.mjs";
import { buildTaskListReportModel, formatReportLeaveText, reportFilterLabel, selectTasksForReport } from "@/lib/taskListReport.mjs";
import type { ServerAuthUser } from "@/lib/serverSession";
import type { TaskListItemDto, TaskListQuery } from "@/lib/taskContracts";

export async function getTaskListReportData(user: ServerAuthUser, query: TaskListQuery, from: string, to: string) {
  if (query.approvalQueue) return { ok: false as const, response: apiError("invalid_request", 400) };
  const canAccessJournalism = canUseJournalism({ roleCode: user.role_code, departmentCode: user.department_code, rbacPermissions: user.rbacPermissions });
  const actor = { id: user.id, departmentId: user.department_id, departmentCode: user.department_code, roleCode: user.role_code, roleLevel: user.role_level, isDepartmentManager: user.is_department_manager, permissions: user.permissions, canAccessJournalism };
  const all: TaskListItemDto[] = [];
  for (let page = 1; page <= 10; page++) {
    const result = await taskRepository.list(actor, { ...query, page, pageSize: 100 });
    if (!result.ok) return { ok: false as const, response: rpcFailure(result.error) };
    if (result.data.total > 1000) return { ok: false as const, response: Response.json({ error: { message: "Có hơn 1.000 công việc. Vui lòng thu hẹp bộ lọc trước khi xuất báo cáo." } }, { status: 400, headers: { "Cache-Control": "no-store" } }) };
    all.push(...result.data.items);
    if (all.length >= result.data.total || result.data.items.length === 0) break;
  }
  const selected = selectTasksForReport(all, from, to);
  const progressResult = await loadLatestTaskProgressReports(selected.map(task => task.id));
  if (!progressResult.ok) return { ok: false as const, response: rpcFailure(progressResult.error) };
  const tasks = selected.map(task => ({ ...task, latest_progress_report: progressResult.data.get(task.id) }));
  let jobTitle = user.role_name || "Nhân viên";
  let leaveText = "………………………………………………";
  try {
    const [staff, leave] = await Promise.allSettled([
      serverSupabase.from("staff_users").select("job_titles(name)").eq("id", user.id).maybeSingle(),
      serverSupabase.from("leave_requests").select("start_date,end_date,start_period,end_period,leave_type,status").eq("requester_id", user.id).eq("status", "approved").lte("start_date", to).gte("end_date", from),
    ]);
    if (staff.status === "fulfilled" && !staff.value.error) {
      const relation = staff.value.data?.job_titles;
      const titleRelation = Array.isArray(relation) ? relation[0] : relation;
      jobTitle = titleRelation?.name?.trim() || jobTitle;
    }
    if (leave.status === "fulfilled" && !leave.value.error) leaveText = formatReportLeaveText(leave.value.data ?? [], from, to);
  } catch {
    // Profile and attendance data are optional; keep the report available with safe fallbacks.
  }
  return { ok: true as const, model: buildTaskListReportModel({ tasks, from, to, userName: user.full_name, jobTitle, leaveText, actorId: user.id, filterLabel: reportFilterLabel(query, all) }) };
}
