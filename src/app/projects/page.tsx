import { Suspense } from "react";
import { classifyTaskDeadline } from "@/lib/deadlineClassification.mjs";
import ProjectCreateForm from "@/components/ProjectCreateForm";
import ProjectsGrid from "@/components/ProjectsGrid";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";
import { projectRepository } from "@/lib/projectRepository";
import { isProjectCreator, projectReader } from "@/lib/projectApiGuards";
import AppNav from "@/components/AppNav";

export default async function ProjectsPage() {
  const user = await getSessionUser(); if (!user) redirect("/login");
  const result = await projectRepository.list(projectReader(user)); if (!result.ok) throw new Error("Không tải được dự án.");
  const options = isProjectCreator(user) ? await projectRepository.options() : null;
  if (options && !options.ok) throw new Error("Project options unavailable");
  const overviews = await Promise.all(result.data.map(async (project) => {
    const [members, tasks] = await Promise.all([projectRepository.listMembers(projectReader(user), project.id), projectRepository.listTasks(projectReader(user), project.id)]);
    return { project, myRole: members.ok ? members.data.find(member => member.user_id === user.id)?.role ?? null : null, leadPeople: members.ok ? members.data.filter(member => member.role === "lead").map(member => ({ id: member.user_id, name: member.staff_users?.full_name ?? "—" })) : [], leads: members.ok ? members.data.filter(member => member.role === "lead").map(member => member.staff_users?.full_name ?? "—") : [], memberCount: members.ok ? members.data.length : null, taskCounts: tasks.ok ? tasks.data.reduce<Record<string, number>>((counts, task) => ({ ...counts, [task.status]: (counts[task.status] ?? 0) + 1, overdue: (counts.overdue ?? 0) + (classifyTaskDeadline(task) === "overdue" ? 1 : 0) }), {}) : null };
  }));
  return <main className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-6"><div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[252px_1fr] lg:gap-5"><AppNav currentPath="/projects" userLabel={`${user.full_name} (${user.role_name})`} /><section className="min-w-0"><header className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-orange-700">Không gian làm việc</p><h1 className="mt-1 text-3xl font-bold">Dự án</h1><p className="mt-1 text-sm text-slate-600">Các dự án bạn đang tham gia.</p></div></header>{options?.ok ? <details className="mb-5"><summary className="w-fit cursor-pointer rounded-lg bg-orange-700 px-4 py-2.5 text-sm font-bold text-white">{"T\u1ea1o d\u1ef1 \u00e1n"}</summary><ProjectCreateForm embedded options={options.data} actorId={user.id} /></details> : null}<Suspense fallback={<p>Đang tải bộ lọc…</p>}><ProjectsGrid projects={overviews} canReadAll={["admin", "tong_bien_tap"].includes(projectReader(user).roleCode)} /></Suspense></section></div></main>;
}
