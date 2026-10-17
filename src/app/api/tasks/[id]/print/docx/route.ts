import { exportTaskPrintDocx, taskPrintDocxFilename } from "@/lib/taskPrintDocxExport";
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
type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const taskId = asUuid((await params).id);
  if (!taskId) return new Response("Not found", { status: 404 });
  const actor: AuthorizationActor = { id: user.id, departmentId: user.department_id, departmentCode: user.department_code, canAccessJournalism: canUseJournalism({ roleCode: user.role_code, departmentCode: user.department_code, rbacPermissions: user.rbacPermissions }), roleCode: user.role_code, roleLevel: user.role_level, permissions: user.permissions };
  const result = await loadPrintableTask({ actor, taskId, loadAccess: (id) => taskRepository.access(id), loadDetail: (id, repositoryActor) => taskRepository.detail(id, repositoryActor), canView: (viewer, access) => canTaskAction(viewer, access, "view") });
  if (!result.ok) return new Response("Not found", { status: 404 });
  const model = buildWorkAssignmentPrintModel(result.task);
  const buffer = await exportTaskPrintDocx(model);
  return new Response(new Uint8Array(buffer), { status: 200, headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${taskPrintDocxFilename(model.title)}"`, "Cache-Control": "no-store" } });
}
