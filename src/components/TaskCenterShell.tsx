"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import PersonalTaskActions from "@/components/PersonalTaskActions";
import { useAuth } from "@/lib/auth";
import { taskListHref } from "@/lib/taskFilters.mjs";
import type { TaskCenterView } from "@/lib/taskCenterView";
import type { TaskListQuery, TaskListResult } from "@/lib/taskContracts";
import EmployeeEvaluationShell from "@/components/EmployeeEvaluationShell";
import type { EvaluationPageData } from "@/lib/evaluationRepository";

type Props = {
  canAssignTask: boolean;
  canViewEvaluations: boolean;
  currentUserId: string;
  departments: { id: string; name: string }[];
  evaluations: EvaluationPageData;
  listError: boolean;
  query: TaskListQuery;
  tasks: TaskListResult;
  userLabel: string;
  view: TaskCenterView;
};

const statusLabels: Record<string, string> = {
  new: "Chưa thực hiện", in_progress: "Đang thực hiện", blocked: "Có vướng mắc",
  waiting: "Chờ phối hợp", pending_review: "Chờ duyệt", done: "Hoàn thành",
  rejected: "Trả lại", cancelled: "Đã hủy",
};

const tabClass = (active: boolean) => `rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
  active ? "border-orange-500 bg-orange-500 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-800"
}`;

const deadlineLabel = (dueDate: string | null, status: string) => {
  if (!dueDate) return "Không deadline";
  if (["done", "cancelled"].includes(status)) return status === "done" ? "Đã hoàn thành" : "Đã hủy";
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const days = Math.ceil((Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  if (days < 0) return "Quá hạn";
  if (days <= 3) return "Sắp đến hạn";
  return "Đúng hạn";
};

function FilterFields({ query, departments }: Pick<Props, "query" | "departments">) {
  return (
    <>
      {query.scope !== "all" ? <input type="hidden" name="scope" value={query.scope} /> : null}
      <input name="q" defaultValue={query.search ?? ""} placeholder="Tìm theo tên công việc" className="w-full min-w-0 rounded-lg border px-3 py-2.5" />
      <select name="type" defaultValue={query.taskType ?? ""} className="w-full min-w-0 rounded-lg border px-3 py-2.5">
        <option value="">Mọi tính chất</option><option value="assigned">Được giao</option><option value="personal">Cá nhân</option>
      </select>
      <select name="status" defaultValue={query.status ?? ""} className="w-full min-w-0 rounded-lg border px-3 py-2.5">
        <option value="">Mọi trạng thái</option>
        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select name="deadline" defaultValue={query.deadlineState ?? ""} className="w-full min-w-0 rounded-lg border px-3 py-2.5">
        <option value="">Mọi thời hạn</option><option value="on_time">Đúng hạn</option><option value="due_soon">Sắp đến hạn</option><option value="overdue">Quá hạn</option><option value="no_deadline">Không deadline</option>
      </select>
      <input name="from" type="date" defaultValue={query.fromDate ?? ""} aria-label="Từ ngày" className="w-full min-w-0 rounded-lg border px-3 py-2.5" />
      <input name="to" type="date" defaultValue={query.toDate ?? ""} aria-label="Đến ngày" className="w-full min-w-0 rounded-lg border px-3 py-2.5" />
      {departments.length ? (
        <select name="department" defaultValue={query.departmentId ?? ""} className="w-full min-w-0 rounded-lg border px-3 py-2.5">
          <option value="">Mọi phòng</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>
      ) : null}
      <div className="flex items-stretch gap-2 sm:col-span-2 lg:col-span-1">
        <button className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">Lọc</button>
        <Link href="/tasks" className="rounded-lg border px-4 py-2 font-semibold">Đặt lại</Link>
      </div>
    </>
  );
}

export default function TaskCenterShell(props: Props) {
  const { canAssignTask, canViewEvaluations, currentUserId, departments, evaluations, listError, query, tasks, userLabel, view } = props;
  const router = useRouter();
  const { logout } = useAuth();
  const onLogout = () => { logout(); router.replace("/login"); };
  const totalPages = Math.max(1, Math.ceil(tasks.total / tasks.pageSize));
  const activeFilters = [query.search, query.taskType, query.status, query.deadlineState, query.fromDate, query.toDate, query.departmentId].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 lg:flex-row lg:gap-6">
        <AppNav currentPath="/tasks" userLabel={userLabel} onLogout={onLogout} />
        <main className="min-w-0 flex-1">
          <header className="overflow-hidden rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">THỜI ĐẠI WORK</p>
            <div className="mt-2 flex flex-col items-start justify-between gap-4 sm:flex-row">
              <div><h1 className="text-2xl font-bold sm:text-3xl">QUẢN LÝ CÔNG VIỆC</h1><p className="mt-1 text-sm text-slate-600">Theo dõi công việc được giao và nhiệm vụ cá nhân</p></div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Link href="/tasks/personal/new" className="rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm">+ Nhiệm vụ cá nhân</Link>
                {canAssignTask ? <Link href="/tasks/assign" className="rounded-lg bg-orange-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm">+ Giao việc</Link> : null}
              </div>
            </div>
            <nav aria-label="Task Center" className="mt-4 flex flex-wrap gap-2">
              <Link href="/tasks?view=work" aria-current={view === "work" ? "page" : undefined} className={tabClass(view === "work")}>Công việc</Link>
              {canViewEvaluations ? <Link href="/tasks?view=evaluations" aria-current={view === "evaluations" ? "page" : undefined} className={tabClass(view === "evaluations")}>Đánh giá nhân viên</Link> : null}
            </nav>
          </header>

          {view === "evaluations" ? (
            <EmployeeEvaluationShell data={evaluations} />
          ) : (
            <>
              <nav aria-label="Phạm vi công việc" className="mt-4 flex flex-wrap gap-2">
                {[["all","Tất cả"],["assigned","Được giao cho tôi"],["personal","Nhiệm vụ cá nhân"],["watching","Tôi theo dõi"]].map(([scope,label]) => (
                  <Link key={scope} href={taskListHref(query, { scope: scope as TaskListQuery["scope"], page: 1 })} className={tabClass(query.scope === scope)}>{label}</Link>
                ))}
              </nav>

              <details className="mt-4 rounded-xl border bg-white p-4 shadow-sm md:hidden">
                <summary className="cursor-pointer font-semibold">Bộ lọc {activeFilters ? `(${activeFilters})` : ""}</summary>
                <form action="/tasks" className="mt-3 grid gap-3"><FilterFields query={query} departments={departments} /></form>
              </details>
              <form action="/tasks" className="mt-4 hidden gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <FilterFields query={query} departments={departments} />
              </form>

              <section className="mt-4 overflow-hidden rounded-xl border bg-white p-3 shadow-sm sm:p-4">
                {listError ? <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">Không thể tải danh sách công việc.</p> : null}
                {!listError && tasks.items.length === 0 ? <p className="p-6 text-center text-slate-600">Không có công việc phù hợp.</p> : null}
                {tasks.items.length ? (
                  <>
                    <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[1120px] border-collapse text-sm">
                      <thead><tr className="border-b text-left text-slate-600"><th className="p-2">Công việc</th><th className="p-2">Tính chất</th><th className="p-2">Người phụ trách</th><th className="p-2">Phòng</th><th className="p-2">Bắt đầu</th><th className="p-2">Deadline</th><th className="p-2">Trạng thái</th><th className="p-2">Thời hạn</th><th className="p-2">Thao tác</th></tr></thead>
                      <tbody>{tasks.items.map((task) => {
                        const canEdit = task.compatibility_task_type === "personal" && !task.legacy_read_only && task.owner_id === currentUserId;
                        return <tr key={task.id} role="link" tabIndex={0} onClick={() => router.push(`/tasks/${task.id}`)} onKeyDown={(event) => { if (event.key === "Enter") router.push(`/tasks/${task.id}`); }} className="cursor-pointer border-b hover:bg-slate-50 focus:bg-slate-50">
                          <td className="p-2 font-semibold">{task.title}{task.legacy_read_only ? <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs">Legacy chỉ đọc</span> : null}</td>
                          <td className="p-2">{task.compatibility_task_type === "personal" ? "Cá nhân" : task.compatibility_task_type === "assigned" ? "Được giao" : "Legacy"}</td>
                          <td className="p-2">{task.task_assignees.find((row) => row.assignment_role !== "watcher")?.staff_users?.full_name ?? "—"}</td>
                          <td className="p-2">{task.departments?.name ?? "—"}</td><td className="p-2">{task.start_date ?? "—"}</td><td className="p-2">{task.due_date ?? "—"}</td><td className="p-2">{statusLabels[task.status] ?? task.status}</td><td className="p-2">{deadlineLabel(task.due_date, task.status)}</td>
                          <td className="p-2"><PersonalTaskActions taskId={task.id} canEdit={canEdit} terminal={["done","cancelled"].includes(task.status)} /></td>
                        </tr>;
                      })}</tbody>
                    </table>
                    </div>
                    <div className="space-y-3 lg:hidden">{tasks.items.map((task) => {
                      const canEdit = task.compatibility_task_type === "personal" && !task.legacy_read_only && task.owner_id === currentUserId;
                      return <article key={task.id} className="rounded-xl border p-4"><Link href={`/tasks/${task.id}`} className="font-bold">{task.title}</Link><dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-slate-500">Tính chất</dt><dd>{task.compatibility_task_type === "personal" ? "Cá nhân" : "Được giao"}</dd></div><div><dt className="text-slate-500">Trạng thái</dt><dd>{statusLabels[task.status]}</dd></div><div><dt className="text-slate-500">Deadline</dt><dd>{task.due_date ?? "—"}</dd></div><div><dt className="text-slate-500">Thời hạn</dt><dd>{deadlineLabel(task.due_date, task.status)}</dd></div></dl><div className="mt-3"><PersonalTaskActions taskId={task.id} canEdit={canEdit} terminal={["done","cancelled"].includes(task.status)} /></div></article>;
                    })}</div>
                  </>
                ) : null}
                <nav aria-label="Phân trang" className="mt-4 flex items-center justify-between border-t pt-4 text-sm"><span>Trang {tasks.page}/{totalPages} · {tasks.total} công việc</span><div className="flex gap-2">{tasks.page > 1 ? <Link className="rounded border px-3 py-2" href={taskListHref(query, { page: tasks.page - 1 })}>Trước</Link> : null}{tasks.page < totalPages ? <Link className="rounded border px-3 py-2" href={taskListHref(query, { page: tasks.page + 1 })}>Sau</Link> : null}</div></nav>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
