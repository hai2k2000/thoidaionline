import { JOURNALISM_UI_HIDDEN } from "@/lib/journalismUiHidden.mjs";
import { projectRepository } from "@/lib/projectRepository";
import { projectReader } from "@/lib/projectApiGuards";
import { isCollaboratorRole } from "@/lib/collaboratorRole.mjs";
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

export async function TasksPage({ searchParams, basePath = "/tasks", forceJournalism = false }: TasksPageProps & { basePath?: string; forceJournalism?: boolean }) {
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
  const collaborator = isCollaboratorRole(user.role_code);
  const rawParams = await searchParams;
  if (collaborator) { delete rawParams.view; delete rawParams.approvalQueue; rawParams.journalism = "exclude"; }
  if (rawParams.view === "evaluations") {
    if (!canViewEvaluations) redirect("/tasks");
    const params = toUrlSearchParams(rawParams); params.delete("view");
    redirect(`/evaluations${params.toString() ? `?${params.toString()}` : ""}`);
  }
  const view = resolveTaskCenterView(rawParams.view, canViewEvaluations);
  const parsedQuery = parseTaskListSearchParams(toUrlSearchParams(rawParams), { defaultJournalism: forceJournalism ? "only" : "exclude" });
  const query = forceJournalism && !JOURNALISM_UI_HIDDEN ? { ...parsedQuery, journalism: "only" as const, approvalQueue: undefined } : parsedQuery;
  if (query.journalism === "only" && !journalismAllowed) redirect("/tasks");
  const workKindsResult = !JOURNALISM_UI_HIDDEN && journalismAllowed ? await listJournalismWorkKinds(query.journalismWorkKindId ?? null) : null;
  const journalismWorkKinds = workKindsResult?.ok ? workKindsResult.data : [];
  const structureFilters = !JOURNALISM_UI_HIDDEN && journalismAllowed ? await listJournalismStructureFilters(user, query.topicId ?? null, query.seriesId ?? null) : { topics: [], series: [] };

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

  const projectsResult = await projectRepository.list(projectReader(user));
  const projects = (projectsResult.ok ? projectsResult.data : []).map(({ id, name, status }) => ({ id, name, status }))
    .sort((a, b) => Number(a.status === "closed") - Number(b.status === "closed") || a.name.localeCompare(b.name, "vi"));

  return (
    <TaskCenterShell
      heading={collaborator ? "C\u00d4NG VI\u1ec6C C\u1ee6A T\u00d4I" : undefined}
      canAssignTask={user.permissions.can_assign_task}
      canQuickReport={user.rbacPermissions.includes("task.quick_report.create")}
      canAccessJournalism={journalismAllowed}
      canClaimTasks={!collaborator && !['tong_bien_tap', 'tbt_read_only'].includes(user.role_code)}
      canReviewTaskApprovals={canReviewTaskApprovals}
      currentUserRole={user.role_code}
      approvalQueue={approvalQueue && {
        assignment: approvalQueue[0].ok ? approvalQueue[0].data : { items: [], total: 0, page: 1, pageSize: 100 },
        completion: approvalQueue[1].ok ? approvalQueue[1].data : { items: [], total: 0, page: 1, pageSize: 100 },
      }}
      currentUserId={user.id}
      projects={projects}
      departments={departments}
      journalismWorkKinds={journalismWorkKinds}
      journalismTopics={structureFilters.topics}
      journalismSeries={structureFilters.series}
      listError={listError}
      query={query}
      tasks={tasks}
      userLabel={user.full_name}
      view={view}
      basePath={basePath}
    />
  );
}

export default TasksPage;
