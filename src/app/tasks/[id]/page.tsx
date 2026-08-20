import { notFound, redirect } from "next/navigation";
import TaskDetailShell from "@/components/TaskDetailShell";
import { canTaskAction, type AuthorizationActor } from "@/lib/authorization";
import { asUuid } from "@/lib/serverApi";
import { getSessionUser } from "@/lib/serverSession";
import { taskRepository } from "@/lib/taskRepository";

type Props = { params: Promise<{ id: string }> };

export default async function TaskDetailPage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const taskId = asUuid((await params).id);
  if (!taskId) notFound();

  const [accessResult, detailResult] = await Promise.all([
    taskRepository.access(taskId),
    taskRepository.detail(taskId),
  ]);
  if (!accessResult.ok || !detailResult.ok) throw new Error("Không thể tải chi tiết công việc.");
  if (!accessResult.data || !detailResult.data) notFound();

  const actor: AuthorizationActor = {
    id: user.id,
    departmentId: user.department_id,
    roleCode: user.role_code,
    roleLevel: user.role_level,
    permissions: user.permissions,
  };
  if (!canTaskAction(actor, accessResult.data, "view")) notFound();

  const action = (name: Parameters<typeof canTaskAction>[2]) =>
    canTaskAction(actor, accessResult.data!, name);
  const task = {
    ...detailResult.data,
    legacy_evaluations: action("legacy_evaluate")
      ? detailResult.data.legacy_evaluations
      : detailResult.data.legacy_evaluations.filter((row) => row.employee_id === user.id),
  };

  return <TaskDetailShell task={task} userLabel={user.full_name} capabilities={{
    report: action("report"),
    review: action("review"),
    update: action("update"),
    comment: action("comment"),
    attachment: action("attachment"),
    evaluate: action("evaluate"),
    leaderEvaluate: action("leader_evaluate"),
    personalComplete: action("personal_complete"),
    personalCancel: action("personal_cancel"),
    personalDeadline: action("personal_deadline"),
    assignedCancel: action("assigned_cancel"),
    adminEdit: action("admin_edit"),
  }} />;
}
