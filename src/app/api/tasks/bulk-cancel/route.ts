import { taskHandlers } from "@/lib/taskHandlers";
import { apiError, apiJson, asUuid, readJsonObject, requireMutationActor } from "@/lib/serverApi";
import { taskRepository } from "@/lib/taskRepository";

const MAX_BATCH = 50;

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  if (guard.actor.role_code !== "admin") return apiError("forbidden", 403);
  const body = await readJsonObject(request);
  const rawTaskIds = Array.isArray(body?.task_ids) && body.task_ids.every((value) => typeof value === "string") ? body.task_ids as string[] : null;
  const taskIds = rawTaskIds?.map(asUuid);
  if (!taskIds || taskIds.length === 0 || taskIds.length > MAX_BATCH || taskIds.some((value) => !value)) return apiError("invalid_request", 400);
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 1000) : "Huỷ hàng loạt bởi quản trị viên";
  const results: Array<{ taskId: string; ok: boolean; status: "cancelled" | "skipped" | "blocked"; reason?: string }> = [];
  for (const taskId of taskIds as string[]) {
    const access = await taskRepository.access(taskId);
    if (!access.ok || !access.data) {
      results.push({ taskId, ok: false, status: "blocked", reason: "Không tìm thấy công việc." });
      continue;
    }
    if (access.data.status === "cancelled") {
      results.push({ taskId, ok: false, status: "skipped", reason: "Công việc đã bị huỷ." });
      continue;
    }
    const response = access.data.taskType === "personal"
      ? await taskHandlers.cancelPersonal(new Request("http://internal/api/tasks/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }), taskId)
      : await taskHandlers.cancelAssigned(new Request("http://internal/api/tasks/cancel-assigned", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }), taskId);
    if (response.ok) results.push({ taskId, ok: true, status: "cancelled" });
    else results.push({ taskId, ok: false, status: "blocked", reason: "Không thể huỷ theo chính sách hiện tại." });
  }
  return apiJson({ results });
}
