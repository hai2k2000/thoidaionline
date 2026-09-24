import { redirect } from "next/navigation";
import WorkAssignmentPrintSheet from "@/components/WorkAssignmentPrintSheet";
import { asUuid } from "@/lib/serverApi";
import { getSessionUser } from "@/lib/serverSession";
import { taskRepository } from "@/lib/taskRepository";
import { canUseJournalism } from "@/lib/journalismScope.mjs";
import { loadPrintableTask } from "@/lib/taskPrintAccess";
import type { AuthorizationActor } from "@/lib/authorization";
import { canTaskAction } from "@/lib/authorization";

type Props = { params: Promise<{ id: string }> };

export default async function TaskPrintPage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const taskId = asUuid((await params).id);
  if (!taskId) redirect("/tasks");
  const actor: AuthorizationActor = {
    id: user.id,
    departmentId: user.department_id,
    departmentCode: user.department_code,
    canAccessJournalism: canUseJournalism({ roleCode: user.role_code, departmentCode: user.department_code, rbacPermissions: user.rbacPermissions }),
    roleCode: user.role_code,
    roleLevel: user.role_level,
    permissions: user.permissions,
  };
  const result = await loadPrintableTask({
    actor,
    taskId,
    loadAccess: (id) => taskRepository.access(id),
    loadDetail: (id, repositoryActor) => taskRepository.detail(id, repositoryActor),
    canView: (viewer, access) => canTaskAction(viewer, access, "view"),
  });
  if (!result.ok) redirect("/tasks");
  return <WorkAssignmentPrintSheet task={result.task} userLabel={user.full_name} />;
}
