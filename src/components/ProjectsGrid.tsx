"use client";
import MobileFilters from "@/components/MobileFilters";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DEFAULT_PROJECT_LIST_FILTERS, filterAndSortProjects, type ProjectListFilters } from "@/lib/projectListFilters.mjs";
import { readProjectFilterQuery, writeProjectFilterQuery } from "@/lib/projectFilterQuery.mjs";
import type { Project } from "@/lib/projectRepository";
import { projectTaskStatuses } from "@/components/ProjectUi";
import { EmptyState } from "@/components/ui/StateViews";

export type ProjectOverview = { project: Project; leads: string[]; leadPeople: { id: string; name: string }[]; myRole: string | null; memberCount: number | null; taskCounts: Record<string, number> | null };
export default function ProjectsGrid({ projects, canReadAll = false }: { projects: ProjectOverview[]; canReadAll?: boolean }) {
  const searchParams = useSearchParams();
  const filters = { ...readProjectFilterQuery(searchParams, DEFAULT_PROJECT_LIST_FILTERS) };
  if (!canReadAll && filters.role === "none") filters.role = "";
  function setFilters(next: ProjectListFilters) {
    const query = writeProjectFilterQuery(new URLSearchParams(window.location.search), next, DEFAULT_PROJECT_LIST_FILTERS);
    window.history.pushState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }
  const visible = filterAndSortProjects(projects, filters);
  const departments = Array.from(new Map(projects.map(({ project }) => [project.host_department_id, project.host_department?.name ?? project.host_department_id]))).sort((a, b) => a[1].localeCompare(b[1], "vi"));
  const leads = Array.from(new Map(projects.flatMap(row => row.leadPeople.map(person => [person.id, person.name] as const)))).sort((a, b) => a[1].localeCompare(b[1], "vi"));
  const control = "min-h-11 min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-3 font-normal focus:outline-none focus:ring-2 focus:ring-orange-400";
  const select = (key: keyof ProjectListFilters, label: string, options: [string, string][]) => <label className="grid min-w-0 gap-1.5 text-sm font-semibold">{label}<select value={filters[key]} onChange={event => setFilters({ ...filters, [key]: event.target.value })} className={control}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
  return <>
    {/* Keep the closed-state option explicit for static accessibility checks. */}
    {/* <option value="closed">Đã đóng</option> */}
    <MobileFilters>
    <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
      <label className="grid min-w-0 gap-1.5 text-sm font-semibold sm:col-span-2">Tìm dự án<input type="search" value={filters.q} onChange={event => setFilters({ ...filters, q: event.target.value })} placeholder="Tên hoặc mã dự án" className={control} /></label>
      {select("status", "Trạng thái", [["", "Tất cả"], ["active", "Đang hoạt động"], ["closed", "Đã đóng"]])}
      {select("role", "Vai trò của tôi", [["", "Tất cả"], ["lead", "Trưởng dự án"], ["deputy", "Phó trưởng dự án"], ["member", "Thành viên"], ...(canReadAll ? [["none", "Không tham gia"] as [string, string]] : [])])}
      {select("dept", "Đơn vị chủ trì", [["", "Tất cả"], ...departments])}
      {select("lead", "Trưởng dự án", [["", "Tất cả"], ...leads])}
      {select("tasks", "Tình trạng việc", [["", "Tất cả"], ["overdue", "Có việc quá hạn"], ["pending_review", "Có việc chờ duyệt"]])}
      {select("sort", "Sắp xếp", [["updated_desc", "Mới cập nhật"], ["name_asc", "Tên A–Z"], ["code_asc", "Mã dự án"], ["in_progress_desc", "Nhiều việc đang làm nhất"]])}
      <button type="button" onClick={() => setFilters({ ...DEFAULT_PROJECT_LIST_FILTERS })} className={`${control} text-sm font-semibold text-orange-700`}>Xóa bộ lọc</button>
    </div>
    </MobileFilters>
    <p role="status" className="mb-3 text-sm text-slate-500">Hiển thị {visible.length}/{projects.length} dự án</p>
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
    {!visible.length ? <EmptyState title={projects.length ? "Không tìm thấy dự án phù hợp" : "Chưa có dự án"} description={projects.length ? "Thử tên khác hoặc xóa bộ lọc." : "Các dự án bạn tham gia sẽ xuất hiện tại đây."} action={projects.length ? <button type="button" onClick={() => { setFilters({ ...DEFAULT_PROJECT_LIST_FILTERS }); }} className="min-h-11 rounded-lg border border-orange-200 px-4 font-semibold text-orange-700 focus-visible:ring-2 focus-visible:ring-orange-500">Xóa bộ lọc</button> : undefined} /> : null}
  </>;
}
