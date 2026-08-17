import { redirect } from "next/navigation";
import TaskCenterShell from "@/components/TaskCenterShell";
import { hasOrganizationTaskView } from "@/lib/authorization";
import { getSessionUser } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { resolveTaskCenterView } from "@/lib/taskCenterView";
import { parseTaskListSearchParams } from "@/lib/taskFilters.mjs";
import { taskRepository } from "@/lib/taskRepository";
import type { TaskListResult } from "@/lib/taskContracts";
import { evaluationRepository, type EvaluationPageData } from "@/lib/evaluationRepository";

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
  const actor = {
    id: user.id,
    departmentId: user.department_id,
    roleCode: user.role_code,
    roleLevel: user.role_level,
    permissions: user.permissions,
  };
  const canViewEvaluations = user.permissions.can_evaluate_step1
    || user.permissions.can_evaluate_step2
    || user.id === actor.id;
  const rawParams = await searchParams;
  const view = resolveTaskCenterView(rawParams.view, canViewEvaluations);
  const query = parseTaskListSearchParams(toUrlSearchParams(rawParams));

  let tasks: TaskListResult = {
    items: [], total: 0, page: query.page, pageSize: query.pageSize,
  };
  let listError = false;
  if (view === "work") {
    const result = await taskRepository.list(actor, query);
    if (result.ok) tasks = result.data;
    else listError = true;
  }
  let evaluations: EvaluationPageData = { items: [], openCycles: [], currentUserId: user.id };
  if (view === "evaluations") evaluations = await evaluationRepository.list(actor, rawParams);

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
      canViewEvaluations={canViewEvaluations}
      currentUserId={user.id}
      departments={departments}
      evaluations={evaluations}
      listError={listError}
      query={query}
      tasks={tasks}
      userLabel={user.full_name}
      view={view}
    />
  );
}
