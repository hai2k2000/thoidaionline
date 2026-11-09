import "server-only";

import { taskRepository } from "@/lib/taskRepository";
import { apiError, rpcFailure } from "@/lib/serverApi";
import { canUseJournalism } from "@/lib/journalismScope.mjs";
import { buildTaskListReportModel, reportFilterLabel, selectTasksForReport } from "@/lib/taskListReport.mjs";
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
  return { ok: true as const, model: buildTaskListReportModel({ tasks: selectTasksForReport(all, from, to), from, to, userName: user.full_name, filterLabel: reportFilterLabel(query, all) }) };
}
