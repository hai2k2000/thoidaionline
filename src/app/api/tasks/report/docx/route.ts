import { contentDisposition } from "@/lib/contentDisposition.mjs";
import { requireReadActor, rpcFailure } from "@/lib/serverApi";
import { apiError } from "@/lib/apiResponse";
import { isCollaboratorRole } from "@/lib/collaboratorRole.mjs";
import { taskRepository } from "@/lib/taskRepository";
import { exportTaskListReportDocx, taskListReportDocxFilename } from "@/lib/taskListReportDocx";
import { parseReportRequest, reportFilterLabel, selectTasksForReport } from "@/lib/taskListReport.mjs";
import { canUseJournalism } from "@/lib/journalismScope.mjs";
import type { TaskListItemDto } from "@/lib/taskContracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  if (isCollaboratorRole(guard.actor.role_code)) return apiError("forbidden", 403);
  const parsed = parseReportRequest(new URL(request.url).searchParams);
  if (!parsed) return apiError("invalid_request", 400);
  const { from, to, query } = parsed;
  if (query.approvalQueue) return apiError("invalid_request", 400);
  const user = guard.actor;
  const canAccessJournalism = canUseJournalism({ roleCode: user.role_code, departmentCode: user.department_code, rbacPermissions: user.rbacPermissions });
  const actor = { id: user.id, departmentId: user.department_id, departmentCode: user.department_code, roleCode: user.role_code, roleLevel: user.role_level, isDepartmentManager: user.is_department_manager, permissions: user.permissions, canAccessJournalism };
  const all: TaskListItemDto[] = [];
  for (let page = 1; page <= 10; page++) {
    const result = await taskRepository.list(actor, { ...query, page, pageSize: 100 });
    if (!result.ok) return rpcFailure(result.error);
    if (result.data.total > 1000) return Response.json({ error: { message: "Có hơn 1.000 công việc. Vui lòng thu hẹp bộ lọc trước khi xuất báo cáo." } }, { status: 400, headers: { "Cache-Control": "no-store" } });
    all.push(...result.data.items);
    if (all.length >= result.data.total || result.data.items.length === 0) break;
  }
  const tasks = selectTasksForReport(all, from, to);
  const buffer = await exportTaskListReportDocx({ tasks, from, to, userName: user.full_name, filterLabel: reportFilterLabel(query, all) });
  return new Response(new Uint8Array(buffer), { status: 200, headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": contentDisposition(taskListReportDocxFilename(from, to)), "Cache-Control": "no-store" } });
}
