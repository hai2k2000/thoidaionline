import { redirect } from "next/navigation";
import TaskCenterShell from "@/components/TaskCenterShell";
import { getSessionUser } from "@/lib/serverSession";
import { parseTaskListSearchParams } from "@/lib/taskFilters.mjs";
import { taskRepository } from "@/lib/taskRepository";
import type { TaskListQuery } from "@/lib/taskContracts";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const toSearch = (input: Record<string, string | string[] | undefined>) => { const result = new URLSearchParams(); for (const [key, value] of Object.entries(input)) { if (Array.isArray(value)) value.forEach((item) => result.append(key, item)); else if (value !== undefined) result.set(key, value); } return result; };

export default async function MyDutySchedulePage({ searchParams }: Props) {
  const user = await getSessionUser(); if (!user) redirect("/login");
  const parsed = parseTaskListSearchParams(toSearch(await searchParams));
  const query = { ...parsed, scope: "assigned", category: "duty" } as TaskListQuery;
  const actor = { id: user.id, departmentId: user.department_id, roleCode: user.role_code, roleLevel: user.role_level, permissions: user.permissions };
  const result = await taskRepository.list(actor, query);
  const tasks = result.ok ? result.data : { items: [], total: 0, page: query.page, pageSize: query.pageSize };
  return <TaskCenterShell canAssignTask={false} canClaimTasks={false} currentUserId={user.id} departments={[]} listError={!result.ok} query={query} tasks={tasks} userLabel={user.full_name} view="work" basePath="/my-duty-schedule" heading="LỊCH TRỰC CÁ NHÂN" taskMode />;
}
