import { redirect } from "next/navigation";
import TaskAssignShell from "@/components/TaskAssignShell";
import { getSessionUser } from "@/lib/serverSession";
import { canAccessTaskAssignment } from "@/lib/taskAssignAccess";
import { taskAssignmentRepository } from "@/lib/taskAssignmentRepository";

export default async function TaskAssignPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canAccessTaskAssignment({ can_assign_task: user.permissions.can_assign_task, role_code: user.role_code })) {
    redirect("/tasks");
  }
  const options = await taskAssignmentRepository.options({
    id: user.id,
    departmentId: user.department_id,
    roleCode: user.role_code,
    roleLevel: user.role_level,
    permissions: user.permissions,
  });
  if (!options.ok) throw new Error("Không thể tải dữ liệu giao việc.");
  return <TaskAssignShell
    departments={options.departments}
    people={options.people}
    userLabel={user.full_name}
  />;
}
