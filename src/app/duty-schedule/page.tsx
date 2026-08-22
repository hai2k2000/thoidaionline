import { redirect } from "next/navigation";
import DutyScheduleViewer from "@/components/DutyScheduleViewer";
import TaskCenterShell from "@/components/TaskCenterShell";
import { getSessionUser } from "@/lib/serverSession";
import { parseTaskListSearchParams } from "@/lib/taskFilters.mjs";
import { taskRepository } from "@/lib/taskRepository";
import type { TaskListQuery } from "@/lib/taskContracts";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const toSearch = (input: Record<string, string | string[] | undefined>) => { const result = new URLSearchParams(); for (const [key, value] of Object.entries(input)) { if (Array.isArray(value)) value.forEach((item) => result.append(key, item)); else if (value !== undefined) result.set(key, value); } return result; };

export default async function DutySchedulePage({ searchParams }: Props) {
  const user = await getSessionUser(); if (!user) redirect("/login");
  const raw = await searchParams;
  if (raw.scope !== "personal") return <DutyScheduleViewer userLabel={user.full_name} initialView={user.preferences.defaultScheduleView} />;
  const parsed = parseTaskListSearchParams(toSearch(raw));
  const query = { ...parsed, scope: "assigned", category: "duty" } as TaskListQuery;
  const actor = { id: user.id, departmentId: user.department_id, roleCode: user.role_code, roleLevel: user.role_level, permissions: user.permissions };
  const result = await taskRepository.list(actor, query);
  const tasks = result.ok ? result.data : { items: [], total: 0, page: query.page, pageSize: query.pageSize };
  return <TaskCenterShell canAssignTask={false} canClaimTasks={false} currentUserId={user.id} departments={[]} listError={!result.ok} query={query} tasks={tasks} userLabel={user.full_name} view="work" basePath="/duty-schedule" heading="LỊCH TRỰC" taskMode />;
}
