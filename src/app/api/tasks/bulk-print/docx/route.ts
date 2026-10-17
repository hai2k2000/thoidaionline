import { exportTaskPrintDocxBatch } from "@/lib/taskPrintDocxExport";
import { asUuid } from "@/lib/serverApi";
import { getSessionUser } from "@/lib/serverSession";
import { taskRepository } from "@/lib/taskRepository";
import { canUseJournalism } from "@/lib/journalismScope.mjs";
import { loadPrintableTask } from "@/lib/taskPrintAccess";
import type { AuthorizationActor } from "@/lib/authorization";
import { canTaskAction } from "@/lib/authorization";
import { buildWorkAssignmentPrintModel } from "@/lib/taskPrintModel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const ids = [...new Set((new URL(request.url).searchParams.get("ids") ?? "").split(",").map(asUuid).filter((id): id is string => Boolean(id)))];
  if (!ids.length || ids.length > 50) return new Response("Invalid task selection", { status: 400 });
  const actor: AuthorizationActor = { id: user.id, departmentId: user.department_id, departmentCode: user.department_code, canAccessJournalism: canUseJournalism({ roleCode: user.role_code, departmentCode: user.department_code, rbacPermissions: user.rbacPermissions }), roleCode: user.role_code, roleLevel: user.role_level, permissions: user.permissions };
  const models = [];
  for (const taskId of ids) {
    const result = await loadPrintableTask({ actor, taskId, loadAccess: (id) => taskRepository.access(id), loadDetail: (id, repositoryActor) => taskRepository.detail(id, repositoryActor), canView: (viewer, access) => canTaskAction(viewer, access, "view") });
    if (result.ok) models.push(buildWorkAssignmentPrintModel(result.task));
  }
  if (!models.length) return new Response("No printable tasks", { status: 404 });
  const buffer = await exportTaskPrintDocxBatch(models);
  return new Response(new Uint8Array(buffer), { status: 200, headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": "attachment; filename=phieu-giao-viec-hang-loat.docx", "Cache-Control": "no-store" } });
}
