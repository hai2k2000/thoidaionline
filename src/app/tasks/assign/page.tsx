import { redirect } from "next/navigation";
import TaskAssignShell from "@/components/TaskAssignShell";
import { getSessionUser } from "@/lib/serverSession";
import { canAccessTaskAssignment } from "@/lib/taskAssignAccess";
import { taskAssignmentRepository } from "@/lib/taskAssignmentRepository";
import { listJournalismWorkKinds } from "@/lib/taskRepository";
import { canUseJournalism } from "@/lib/journalismScope.mjs";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TaskAssignPage({ searchParams }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canAccessTaskAssignment({ can_assign_task: user.permissions.can_assign_task, role_code: user.role_code })) {
    redirect("/tasks");
  }
  const rawParams = await searchParams;
  const journalismMode = rawParams.kind === "journalism";
  const journalismAllowed = canUseJournalism({ roleCode: user.role_code, departmentCode: user.department_code, rbacPermissions: user.rbacPermissions });
  if (journalismMode && !journalismAllowed) redirect("/tasks");
  const workKindsResult = journalismMode ? await listJournalismWorkKinds() : null;
  const journalismWorkKinds = workKindsResult?.ok ? workKindsResult.data.filter((kind) => kind.is_active) : [];
  const options = await taskAssignmentRepository.options({
    id: user.id,
    departmentId: user.department_id,
    roleCode: user.role_code,
    roleLevel: user.role_level,
    permissions: user.permissions,
  });
  if (!options.ok) throw new Error("Không thể tải dữ liệu giao việc.");
  const journalismDepartment = options.departments.find((department) => department.code === "editorial") ?? null;
  if (journalismMode && !journalismDepartment) redirect("/tasks");
  return <TaskAssignShell
    departments={options.departments}
    people={options.people}
    userLabel={user.full_name}
    canManageEventAssignment={user.role_code === "admin" || user.role_code === "tong_bien_tap" || user.role_code === "pho_tong_bien_tap" || user.role_code === "truong_phong" || user.is_department_manager}
    canAccessJournalism={journalismAllowed}
    journalismMode={journalismMode}
    journalismDepartment={journalismDepartment}
    journalismWorkKinds={journalismWorkKinds}
    journalismWorkKindsLoaded={Boolean(workKindsResult?.ok)}
  />;
}
