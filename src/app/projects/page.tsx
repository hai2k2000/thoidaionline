import ProjectCreateForm from "@/components/ProjectCreateForm";
import Link from "next/link";
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
  return <main className="min-h-screen bg-slate-50 p-3 text-slate-900 sm:p-6"><div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[252px_1fr] lg:gap-5"><AppNav currentPath="/projects" userLabel={`${user.full_name} (${user.role_name})`} /><section className="min-w-0"><header className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-orange-700">Không gian làm việc</p><h1 className="mt-1 text-3xl font-bold">Dự án</h1><p className="mt-1 text-sm text-slate-600">Các dự án bạn đang tham gia.</p></div></header>{options?.ok ? <details className="mb-5"><summary className="w-fit cursor-pointer rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white">{"T\u1ea1o d\u1ef1 \u00e1n"}</summary><ProjectCreateForm embedded options={options.data} actorId={user.id} /></details> : null}<div className="grid gap-3 md:grid-cols-2">{result.data.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs text-slate-500">{project.code}</p><h2 className="mt-1 text-xl font-bold">{project.name}</h2></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${project.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{project.status === "active" ? "Đang hoạt động" : "Đã đóng"}</span></div>{project.description ? <p className="mt-3 line-clamp-3 text-sm text-slate-600">{project.description}</p> : null}</Link>)}{result.data.length === 0 ? <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-slate-500 md:col-span-2">Chưa có dự án.</p> : null}</div></section></div></main>;
}
