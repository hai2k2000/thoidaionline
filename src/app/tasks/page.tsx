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
import { loadDepartmentLeaderIds, hasGlobalPersonFilter } from "@/lib/taskDepartmentLeaders.mjs";

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
  const leaderDepartments = await loadDepartmentLeaderIds(serverSupabase, user.id);
  const globalPersonFilter = hasGlobalPersonFilter(user.role_code);
  const canFilterByPerson = globalPersonFilter || (!leaderDepartments.error && leaderDepartments.data.length > 0);
  if (!canFilterByPerson) delete query.personId;
  const personOptions: {id: string; fullName: string; username: string; departmentName: string}[] = [];
  if (canFilterByPerson) {
    for (let from = 0; ; from += 500) {
      let peopleQuery = serverSupabase.from("staff_users")
        .select("id,full_name,username,departments!staff_users_department_id_fkey(name)")
        .eq("active", true).order("full_name").order("id").range(from, from + 499);
      if (!globalPersonFilter) peopleQuery = peopleQuery.in("department_id", leaderDepartments.data);
      const people = await peopleQuery;
      if (people.error) throw new Error("Cannot load personnel filters.");
      for (const person of people.data ?? []) {
        const department = Array.isArray(person.departments) ? person.departments[0] : person.departments;
        personOptions.push({id: person.id, fullName: person.full_name, username: person.username, departmentName: department?.name ?? ""});
      }
      if ((people.data?.length ?? 0) < 500) break;
    }
  }
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
      canSeeDepartmentCollaborating={!leaderDepartments.error && Boolean(leaderDepartments.data.length)}
      canFilterByPerson={canFilterByPerson}
      personOptions={personOptions}
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
