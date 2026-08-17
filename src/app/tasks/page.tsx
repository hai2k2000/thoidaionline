import { redirect } from "next/navigation";
import TaskCenterShell from "@/components/TaskCenterShell";
import { getSessionUser } from "@/lib/serverSession";
import { resolveTaskCenterView } from "@/lib/taskCenterView";

type TasksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const canViewEvaluations =
    user.permissions.can_evaluate_step1 ||
    user.permissions.can_evaluate_step2;
  const params = await searchParams;
  const view = resolveTaskCenterView(params.view, canViewEvaluations);

  return (
    <TaskCenterShell
      canAssignTask={user.permissions.can_assign_task}
      canViewEvaluations={canViewEvaluations}
      userLabel={user.full_name}
      view={view}
    />
  );
}
