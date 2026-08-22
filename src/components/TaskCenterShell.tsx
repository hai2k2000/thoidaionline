"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import PersonalTaskActions from "@/components/PersonalTaskActions";
import { useAuth } from "@/lib/auth";
import { taskListHref } from "@/lib/taskFilters.mjs";
import { classifyTaskDeadline } from "@/lib/deadlineClassification.mjs";
import type { TaskCenterView } from "@/lib/taskCenterView";
import type { TaskListQuery, TaskListResult } from "@/lib/taskContracts";

type Props = {
  canAssignTask: boolean;
  canClaimTasks: boolean;
  currentUserId: string;
  departments: { id: string; name: string }[];
  listError: boolean;
  query: TaskListQuery;
  tasks: TaskListResult;
  userLabel: string;
  view: TaskCenterView;
};

const taskStatusLabel = (status: string) =>
  status === "done" ? "Đã hoàn thành"
    : status === "pending_review" ? "Chờ duyệt"
      : status === "rejected" ? "Trả lại"
        : status === "cancelled" ? "Đã hủy"
          : "Chưa hoàn thành";
const statusClass = (status: string) => status === "done" ? "bg-emerald-100 text-emerald-800" : status === "rejected" ? "bg-red-100 text-red-800" : status === "cancelled" ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-800";

const tabClass = (active: boolean) => `rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
  active ? "border-orange-500 bg-orange-500 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-800"
}`;

const deadlineLabel = (task: TaskListResult["items"][number]) => {
  if (task.status === "cancelled") return "Đã hủy";
  const state = classifyTaskDeadline(task);
  return state === "no_deadline" ? "Không deadline" : state === "overdue" ? "Quá hạn" : state === "due_soon" ? "Sắp đến hạn" : "Đúng hạn";
};

const dueText = (dueDate: string | null, dueTime: string | null) =>
  dueDate ? `${dueDate}${dueTime ? ` ${dueTime.slice(0, 5)}` : ""}` : "—";

function FilterFields({ query, departments }: Pick<Props, "query" | "departments">) {
  return (
    <>
      {query.scope !== "all" ? <input type="hidden" name="scope" value={query.scope} /> : null}
      <input name="q" defaultValue={query.search ?? ""} placeholder="Tìm theo tên công việc" className="w-full min-w-0 rounded-lg border px-3 py-2.5" />
      <select name="state" defaultValue={query.statusGroup ?? ""} className="w-full min-w-0 rounded-lg border px-3 py-2.5">
        <option value="">Trạng thái</option><option value="completed">Đã hoàn thành</option><option value="unfinished">Chưa hoàn thành</option><option value="returned">Trả lại</option><option value="cancelled">Đã hủy</option>
      </select>
      <select name="deadline" defaultValue={query.deadlineState ?? ""} className="w-full min-w-0 rounded-lg border px-3 py-2.5">
        <option value="">Thời hạn</option><option value="on_time">Đúng hạn</option><option value="due_soon">Sắp đến hạn</option><option value="overdue">Quá hạn</option><option value="no_deadline">Không deadline</option>
      </select>
      <input name="from" type="date" defaultValue={query.fromDate ?? ""} aria-label="Từ ngày" className="w-full min-w-0 rounded-lg border px-3 py-2.5" />
      <input name="to" type="date" defaultValue={query.toDate ?? ""} aria-label="Đến ngày" className="w-full min-w-0 rounded-lg border px-3 py-2.5" />
      {departments.length ? (
        <select name="department" defaultValue={query.departmentId ?? ""} className="w-full min-w-0 rounded-lg border px-3 py-2.5">
          <option value="">Phòng</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
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
  const { canClaimTasks, currentUserId, departments, listError, query, tasks, userLabel } = props;
  const router = useRouter();
  const { logout } = useAuth();
  const onLogout = () => { logout(); router.replace("/login"); };
  const totalPages = Math.max(1, Math.ceil(tasks.total / tasks.pageSize));
  const activeFilters = [query.search, query.taskType, query.category, query.category, query.category, query.category, query.category, query.category, query.category, query.category, query.category, query.category, query.category, query.category, query.category, query.category, query.category, query.status, query.statusGroup, query.deadlineState, query.fromDate, query.toDate, query.departmentId].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 lg:flex-row lg:gap-4">
        <AppNav currentPath="/tasks" userLabel={userLabel} onLogout={onLogout} />
        <main className="min-w-0 flex-1">
          <header className="overflow-hidden rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
              <div><h1 className="text-2xl font-bold sm:text-3xl">QUẢN LÝ CÔNG VIỆC</h1></div>
              <Link href="/tasks/personal/new" className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm sm:w-auto">+ Tạo công việc</Link>
            </div>
            <nav aria-label="Task Center" className="mt-4 flex flex-wrap gap-2">
            </nav>
          </header>

          <>
              <nav aria-label="Phạm vi công việc" className="mt-3 flex flex-wrap gap-2">
                {[["all","Tất cả"],["assigned","Được giao cho tôi"],["personal","Nhiệm vụ cá nhân"],["watching","Tôi theo dõi"]].map(([scope,label]) => (
                  <Link key={scope} href={taskListHref(query, { scope: scope as TaskListQuery["scope"], page: 1 })} className={tabClass(query.scope === scope)}>{label}</Link>
                ))}
                <Link href={taskListHref(query, { scope: "cancelled", page: 1 })} className={tabClass(query.scope === "cancelled")}>Đã hủy</Link>
              </nav>

              <details className="mt-3 rounded-xl border bg-white p-3 shadow-sm md:hidden">
                <summary className="cursor-pointer font-semibold">Bộ lọc {activeFilters ? `(${activeFilters})` : ""}</summary>
                <form action="/tasks" className="mt-3 grid gap-3"><FilterFields query={query} departments={departments} /></form>
              </details>
              <form action="/tasks" className="mt-3 hidden gap-2.5 rounded-xl border bg-white p-3 shadow-sm md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <FilterFields query={query} departments={departments} />
              </form>

              <section className="mt-3 overflow-hidden rounded-xl border bg-white p-3 shadow-sm">
                {listError ? <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">Không thể tải danh sách công việc.</p> : null}
                {!listError && tasks.items.length === 0 ? <p className="p-6 text-center text-slate-600">Không có công việc phù hợp.</p> : null}
                {tasks.items.length ? (
                  <>
                    <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[980px] border-collapse text-sm">
                      <thead><tr className="border-b text-left text-slate-600"><th className="p-2">Công việc</th><th className="p-2">Người phụ trách</th><th className="p-2">Trạng thái</th><th className="p-2">Deadline</th><th className="p-2">Thời hạn</th><th className="p-2">Phòng</th><th className="p-2">Tính chất</th><th className="p-2">Bắt đầu</th><th className="p-2">Thao tác</th></tr></thead>
                      <tbody>{tasks.items.map((task) => {
                        const canEdit = task.compatibility_task_type === "personal" && !task.legacy_read_only && task.owner_id === currentUserId;
                        const canClaim = canClaimTasks && task.self_claimable && task.status === "new" && task.assignee_id === null;
                        return <tr key={task.id} role="link" tabIndex={0} onClick={() => router.push(`/tasks/${task.id}`)} onKeyDown={(event) => { if (event.key === "Enter") router.push(`/tasks/${task.id}`); }} className="cursor-pointer border-b hover:bg-slate-50 focus:bg-slate-50">
                          <td className="p-2 font-semibold">{task.title}{task.legacy_read_only ? <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs">Legacy chỉ đọc</span> : null}</td>
                          <td className="p-2">{task.task_assignees.find((row) => row.assignment_role !== "watcher")?.staff_users?.full_name ?? "—"}</td>
                          <td className="p-2"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(task.status)}`}>{taskStatusLabel(task.status)}</span></td><td className="p-2">{dueText(task.due_date, task.due_time)}</td><td className="p-2">{deadlineLabel(task)}</td><td className="p-2">{task.departments?.name ?? "—"}</td><td className="p-2">{task.task_category === "duty" ? "Trực sản xuất" : task.compatibility_task_type === "personal" ? "Nhiệm vụ cá nhân" : task.compatibility_task_type === "assigned" ? "Công việc được giao" : "Legacy"}</td><td className="p-2">{task.start_date ?? "—"}</td>
                          <td className="p-2"><PersonalTaskActions taskId={task.id} canEdit={canEdit} canClaim={canClaim} terminal={["done","cancelled"].includes(task.status)} /></td>
                        </tr>;
                      })}</tbody>
                    </table>
                    </div>
                    <div className="space-y-3 lg:hidden">{tasks.items.map((task) => {
                      const canEdit = task.compatibility_task_type === "personal" && !task.legacy_read_only && task.owner_id === currentUserId;
                      const canClaim = canClaimTasks && task.self_claimable && task.status === "new" && task.assignee_id === null;
                      return <article key={task.id} className="rounded-xl border p-4"><Link href={`/tasks/${task.id}`} className="font-bold">{task.title}</Link><dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-slate-500">Tính chất</dt><dd>{task.compatibility_task_type === "personal" ? "Nhiệm vụ cá nhân" : "Công việc được giao"}</dd></div><div><dt className="text-slate-500">Trạng thái</dt><dd><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(task.status)}`}>{taskStatusLabel(task.status)}</span></dd></div><div><dt className="text-slate-500">Deadline</dt><dd>{dueText(task.due_date, task.due_time)}</dd></div><div><dt className="text-slate-500">Thời hạn</dt><dd>{deadlineLabel(task)}</dd></div></dl><div className="mt-3"><PersonalTaskActions taskId={task.id} canEdit={canEdit} canClaim={canClaim} terminal={["done","cancelled"].includes(task.status)} /></div></article>;
                    })}</div>
                  </>
                ) : null}
                <nav aria-label="Phân trang" className="mt-4 flex items-center justify-between border-t pt-4 text-sm"><span>Trang {tasks.page}/{totalPages} · {tasks.total} công việc</span><div className="flex gap-2">{tasks.page > 1 ? <Link className="rounded border px-3 py-2" href={taskListHref(query, { page: tasks.page - 1 })}>Trước</Link> : null}{tasks.page < totalPages ? <Link className="rounded border px-3 py-2" href={taskListHref(query, { page: tasks.page + 1 })}>Sau</Link> : null}</div></nav>
              </section>
          </>
        </main>
      </div>
    </div>
  );
}
