import { redirect } from "next/navigation";
import TaskCenterShell from "@/components/TaskCenterShell";
import { hasOrganizationTaskView } from "@/lib/authorization";
import { getSessionUser } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { resolveTaskCenterView } from "@/lib/taskCenterView";
import { parseTaskListSearchParams } from "@/lib/taskFilters.mjs";
import { listJournalismWorkKinds, taskRepository } from "@/lib/taskRepository";
import { listJournalismStructureFilters } from "@/lib/journalismStructureRepository";
import type { TaskListResult } from "@/lib/taskContracts";
import { canUseJournalism } from "@/lib/journalismScope.mjs";

type TasksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const toUrlSearchParams = (input: Record<string, string | string[] | undefined>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.set(key, value);
  }
  return params;
};

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const journalismAllowed = canUseJournalism({ roleCode: user.role_code, departmentCode: user.department_code, rbacPermissions: user.rbacPermissions });
  const actor = {
    id: user.id,
    departmentId: user.department_id,
    departmentCode: user.department_code,
    canAccessJournalism: journalismAllowed,
    roleCode: user.role_code,
    roleLevel: user.role_level,
    isDepartmentManager: user.is_department_manager,
    permissions: user.permissions,
  };
  const canViewEvaluations = user.permissions.can_evaluate_step1
    || user.permissions.can_evaluate_step2;
  const canReviewTaskApprovals = user.role_code === "admin"
    || user.role_code === "tong_bien_tap"
    || user.role_code === "pho_tong_bien_tap"
    || user.is_department_manager === true;
  const rawParams = await searchParams;
  if (rawParams.view === "evaluations") {
    if (!canViewEvaluations) redirect("/tasks");
    const params = toUrlSearchParams(rawParams); params.delete("view");
    redirect(`/evaluations${params.toString() ? `?${params.toString()}` : ""}`);
  }
  const view = resolveTaskCenterView(rawParams.view, canViewEvaluations);
  const query = parseTaskListSearchParams(toUrlSearchParams(rawParams), { defaultJournalism: "exclude" });
  if (query.journalism === "only" && !journalismAllowed) redirect("/tasks");
  const workKindsResult = journalismAllowed ? await listJournalismWorkKinds(query.journalismWorkKindId ?? null) : null;
  const journalismWorkKinds = workKindsResult?.ok ? workKindsResult.data : [];
  const structureFilters = journalismAllowed ? await listJournalismStructureFilters(user, query.topicId ?? null, query.seriesId ?? null) : { topics: [], series: [] };

  let tasks: TaskListResult = {
    items: [], total: 0, page: query.page, pageSize: query.pageSize,
  };
  let listError = false;
  if (view === "work" && !query.approvalQueue) {
    const result = await taskRepository.list(actor, query);
    if (result.ok) tasks = result.data;
    else listError = true;
  }
  const approvalQueue = canReviewTaskApprovals ? await Promise.all([
    taskRepository.listApprovalQueue(actor, "assignment"),
    taskRepository.listApprovalQueue(actor, "completion"),
  ]) : null;

  let departments: { id: string; name: string }[] = [];
  if (hasOrganizationTaskView(actor) || user.permissions.can_view_department_tasks) {
    let departmentQuery = serverSupabase
      .from("departments")
      .select("id,name")
      .eq("active", true)
      .order("name");
    if (!hasOrganizationTaskView(actor) && user.department_id) {
      departmentQuery = departmentQuery.eq("id", user.department_id);
    }
    const result = await departmentQuery;
    departments = (result.data ?? []) as { id: string; name: string }[];
  }

  return (
    <TaskCenterShell
      canAssignTask={user.permissions.can_assign_task}
      canAccessJournalism={journalismAllowed}
      canClaimTasks={!['tong_bien_tap', 'tbt_read_only'].includes(user.role_code)}
      canReviewTaskApprovals={canReviewTaskApprovals}
      approvalQueue={approvalQueue && {
        assignment: approvalQueue[0].ok ? approvalQueue[0].data : { items: [], total: 0, page: 1, pageSize: 100 },
        completion: approvalQueue[1].ok ? approvalQueue[1].data : { items: [], total: 0, page: 1, pageSize: 100 },
      }}
      currentUserId={user.id}
      departments={departments}
      journalismWorkKinds={journalismWorkKinds}
      journalismTopics={structureFilters.topics}
      journalismSeries={structureFilters.series}
      listError={listError}
      query={query}
      tasks={tasks}
      userLabel={user.full_name}
      view={view}
    />
  );
}
