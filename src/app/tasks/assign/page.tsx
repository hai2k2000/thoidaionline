import { redirect } from "next/navigation";
import TaskAssignShell from "@/components/TaskAssignShell";
import { getSessionUser } from "@/lib/serverSession";
import { canAccessTaskAssignment } from "@/lib/taskAssignAccess";

export default async function TaskAssignPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (
    !canAccessTaskAssignment({
      can_assign_task: user.permissions.can_assign_task,
    })
  ) redirect("/tasks");

  return <TaskAssignShell userLabel={user.full_name} />;
}
