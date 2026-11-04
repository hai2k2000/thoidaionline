"use client";
import Link from "next/link";
import { useState } from "react";
import type { Project } from "@/lib/projectRepository";
import { projectTaskStatuses, ProjectIcon } from "@/components/ProjectUi";

export type ProjectOverview = { project: Project; leads: string[]; memberCount: number | null; taskCounts: Record<string, number> | null };
export default function ProjectsGrid({ projects }: { projects: ProjectOverview[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const query = search.trim().toLocaleLowerCase("vi-VN");
  const visible = projects.filter(({ project }) => (!status || project.status === status) && (!query || `${project.code} ${project.name}`.toLocaleLowerCase("vi-VN").includes(query)));
  return <>
    <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_200px]">
      <label className="grid gap-1.5 text-sm font-semibold">Tìm dự án<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tên hoặc mã dự án" className="min-h-11 min-w-0 rounded-lg border border-slate-300 px-3 font-normal focus:outline-none focus:ring-2 focus:ring-orange-400" /></label>
      <label className="grid gap-1.5 text-sm font-semibold">Trạng thái<select value={status} onChange={event => setStatus(event.target.value)} className="min-h-11 rounded-lg border border-slate-300 px-3 font-normal focus:outline-none focus:ring-2 focus:ring-orange-400"><option value="">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="closed">Đã đóng</option></select></label>
    </div>
    <p role="status" className="mb-3 text-sm text-slate-500">{visible.length} dự án</p>
    <div className="grid gap-4 md:grid-cols-2">
      {visible.map(({ project, leads, memberCount, taskCounts }) => <Link key={project.id} href={`/projects/${project.id}`} className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="max-w-full break-words rounded-md bg-orange-50 px-2.5 py-1 font-mono text-xs font-semibold text-orange-800">{project.code}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${project.status === "active" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{project.status === "active" ? "Đang hoạt động" : "Đã đóng"}</span></div>
        <h2 className="mt-4 break-words border-l-4 border-orange-500 pl-3 text-xl font-bold leading-snug text-slate-900 group-hover:text-orange-800">{project.name}</h2>
        {project.description ? <p className="mt-3 line-clamp-2 break-words text-sm leading-6 text-slate-600">{project.description}</p> : null}
        <dl className="mt-4 grid gap-2 border-t border-slate-100 pt-4 text-sm"><div className="min-w-0"><dt className="text-xs text-slate-500">Trưởng dự án</dt><dd className="mt-1 break-words font-medium">{leads.join(", ") || "Chưa có thông tin"}</dd></div><div className="flex flex-wrap gap-1 text-slate-600"><dt>Thành viên:</dt><dd className="font-semibold text-slate-900">{memberCount ?? "—"}</dd></div></dl>
        {taskCounts ? <div className="mt-3 flex flex-wrap gap-2">{Object.entries(projectTaskStatuses).map(([value, label]) => taskCounts[value] ? <span key={value} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">{label} <b className="text-slate-900">{taskCounts[value]}</b></span> : null)}{!Object.values(taskCounts).some(Boolean) ? <span className="text-xs text-slate-500">Chưa có công việc</span> : null}</div> : null}
        <p className="mt-4 text-xs text-slate-500">Cập nhật {new Date(project.updated_at).toLocaleDateString("vi-VN")}</p>
      </Link>)}
    </div>
    {!visible.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-700"><ProjectIcon /></span><h2 className="mt-4 font-bold">{projects.length ? "Không tìm thấy dự án phù hợp" : "Chưa có dự án"}</h2><p className="mt-2 text-sm text-slate-600">{projects.length ? "Thử tên khác hoặc bỏ bộ lọc trạng thái." : "Các dự án bạn tham gia sẽ xuất hiện tại đây."}</p>{projects.length ? <button type="button" onClick={() => { setSearch(""); setStatus(""); }} className="mt-4 min-h-11 rounded-lg border border-orange-200 px-4 font-semibold text-orange-700 focus-visible:ring-2 focus-visible:ring-orange-500">Xóa bộ lọc</button> : null}</div> : null}
  </>;
}
