"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
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
  basePath?: string;
  heading?: string;
  taskMode?: boolean;
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
  return state === "no_deadline" ? "Không có hạn" : state === "overdue" ? "Quá hạn" : state === "due_soon" ? "Sắp đến hạn" : "Đúng hạn";
};

const dueText = (dueDate: string | null, dueTime: string | null) => {
  if (!dueDate) return "—";
  const [year, month, day] = dueDate.split("-");
  return `${day}/${month}/${year.slice(-2)}${dueTime ? ` ${dueTime.slice(0, 5)}` : ""}`;
};

const requirementsOf = (task: TaskListResult["items"][number]) => {
  try { const value = JSON.parse(task.evaluation_criteria ?? "[]"); return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; } catch { return []; }
};
const periodRange = (period: "day" | "week" | "month") => {
  const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const end = new Date(start);
  if (period === "week") { start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); end.setTime(start.getTime()); end.setDate(end.getDate() + 6); }
  if (period === "month") { start.setDate(1); end.setMonth(end.getMonth() + 1, 0); }
  const text = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { fromDate: text(start), toDate: text(end), page: 1 };
};

const participantNames = (task: TaskListResult["items"][number], role: "assignee" | "watcher") =>
  task.task_assignees.filter((row) => row.assignment_role === role).map((row) => row.staff_users?.full_name).filter(Boolean).join(", ") || "—";

function FilterFields({ query, departments, basePath = "/tasks" }: Pick<Props, "query" | "departments" | "basePath">) {
  return (
    <>
      {basePath === "/duty-schedule" ? <input type="hidden" name="scope" value="personal" /> : query.scope !== "all" ? <input type="hidden" name="scope" value={query.scope} /> : null}
      {query.category ? <input type="hidden" name="category" value={query.category} /> : null}
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
        <Link href={basePath === "/duty-schedule" ? "/duty-schedule?scope=personal" : basePath} className="rounded-lg border px-4 py-2 font-semibold">Đặt lại</Link>
      </div>
    </>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white p-2"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-0.5 break-words text-sm">{value}</dd></div>;
}

export default function TaskCenterShell(props: Props) {
  const { canClaimTasks, currentUserId, departments, listError, query, tasks, userLabel, basePath = "/tasks", heading = "BẢNG TỔNG HỢP CÔNG VIỆC", taskMode = false } = props;
  const router = useRouter();
  const tableRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { logout } = useAuth();
  const onLogout = () => { logout(); router.replace("/login"); };
  const totalPages = Math.max(1, Math.ceil(tasks.total / tasks.pageSize));
  const activeFilters = [query.search, query.taskType, query.category, query.category, query.category, query.category, query.category, query.category, query.category, query.category, query.category, query.category, query.category, query.category, query.category, query.category, query.category, query.status, query.statusGroup, query.deadlineState, query.fromDate, query.toDate, query.departmentId].filter(Boolean).length;
  const listHref = (patch: Partial<TaskListQuery>) => { const href = taskListHref(query, patch).replace(/^\/tasks/, basePath); if (!taskMode) return href; const url = new URL(href, "http://local"); url.searchParams.set("scope", "personal"); return `${url.pathname}?${url.searchParams.toString()}`; };
  useEffect(() => { const close = (event: PointerEvent) => { if (tableRef.current && !tableRef.current.contains(event.target as Node)) setExpandedId(null); }; document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 lg:flex-row lg:gap-4">
        <AppNav currentPath={basePath} userLabel={userLabel} onLogout={onLogout} />
        <main className="min-w-0 flex-1">
          <header className="overflow-hidden rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
              <div><h1 className="text-2xl font-bold sm:text-3xl">{heading}</h1></div>
              {!taskMode ? <Link href="/tasks/personal/new" className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm sm:w-auto">+ Tạo công việc</Link> : null}
            </div>
            <nav aria-label="Task Center" className="mt-4 flex flex-wrap gap-2">
            </nav>
          </header>

          <>
              {taskMode ? <nav aria-label="Phạm vi lịch trực" className="mt-3 flex rounded-lg border border-orange-200 bg-white p-1 sm:w-fit"><Link href="/duty-schedule" className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-600">Toàn cơ quan</Link><span className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white">Cá nhân</span></nav> : <nav aria-label="Phạm vi công việc" className="mt-3 flex flex-wrap gap-2">
                {[["all","Tất cả"],["assigned","Được giao cho tôi"],["personal","Nhiệm vụ cá nhân"],["watching","Tôi theo dõi"]].map(([scope,label]) => (
                  <Link key={scope} href={listHref({ scope: scope as TaskListQuery["scope"], page: 1 })} className={tabClass(query.scope === scope)}>{label}</Link>
                ))}
                <Link href={listHref({ scope: "cancelled", page: 1 })} className={tabClass(query.scope === "cancelled")}>Đã hủy</Link>
              </nav>}

              <details className="mt-3 rounded-xl border bg-white p-3 shadow-sm md:hidden">
                <summary className="cursor-pointer font-semibold">Bộ lọc {activeFilters ? `(${activeFilters})` : ""}</summary>
                <form action={basePath} className="mt-3 grid gap-3"><FilterFields query={query} departments={departments} basePath={basePath} /></form>
              </details>
              <form action={basePath} className="mt-3 hidden gap-2.5 rounded-xl border bg-white p-3 shadow-sm md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <FilterFields query={query} departments={departments} basePath={basePath} />
              </form>

              <section className="mt-3 overflow-hidden rounded-xl border bg-white p-3 shadow-sm">
                {!taskMode ? <div className="mb-3 flex flex-wrap items-center gap-2 border-b pb-3"><span className="text-sm font-semibold text-slate-600">Xem theo:</span>{([['day','Ngày'],['week','Tuần'],['month','Tháng']] as const).map(([period, label]) => <Link key={period} href={listHref(periodRange(period))} className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-semibold text-orange-800">{label}</Link>)}</div> : null}
                {listError ? <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">Không thể tải danh sách công việc.</p> : null}
                {!listError && tasks.items.length === 0 ? <p className="p-6 text-center text-slate-600">Không có công việc phù hợp.</p> : null}
                {tasks.items.length ? (
                  <>
                    <div ref={tableRef} className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[980px] border-collapse text-sm">
                      <thead><tr className="border-b text-left text-slate-600"><th className="p-2">Tên công việc</th><th className="p-2">Người nhận việc</th><th className="p-2">Người giao</th><th className="p-2">Người theo dõi</th><th className="p-2">Hạn hoàn thành</th><th className="p-2">Điểm</th><th className="p-2">Trạng thái</th></tr></thead>
                      <tbody>{tasks.items.map((task) => {
                        const open = expandedId === task.id;
                        const requirements = requirementsOf(task);
                        return <Fragment key={task.id}><tr role="button" tabIndex={0} aria-expanded={open} onClick={() => setExpandedId(open ? null : task.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setExpandedId(open ? null : task.id); }} className={`cursor-pointer border-b hover:bg-orange-50 focus:bg-orange-50 ${open ? "bg-orange-50" : ""}`}>
                          <td className="p-2 font-semibold">{task.title}{task.legacy_read_only ? <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs">Dữ liệu cũ · chỉ đọc</span> : null}</td><td className="p-2">{participantNames(task, "assignee")}</td><td className="p-2">{task.created_by_user?.full_name ?? "—"}</td><td className="p-2">{participantNames(task, "watcher")}</td><td className="p-2">{dueText(task.due_date, task.due_time)}</td><td className="p-2 font-semibold">{task.completion_score?.total_score ?? "—"}</td><td className="p-2"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(task.status)}`}>{taskStatusLabel(task.status)}</span></td>
                        </tr>{open ? <tr className="border-b bg-orange-50/40"><td colSpan={7} className="p-4"><div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]"><div><h3 className="font-bold text-orange-900">Yêu cầu công việc</h3>{requirements.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{requirements.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{task.description || "Chưa có yêu cầu."}</p>}</div><dl className="grid grid-cols-2 gap-2 text-sm"><SummaryItem label="Trạng thái" value={taskStatusLabel(task.status)} /><SummaryItem label="Đánh giá" value={task.completion_score?.note || "Chưa có đánh giá"} /><SummaryItem label="Đáp ứng yêu cầu" value={task.completion_score ? `${task.completion_score.requirement_score}/60` : "—"} /><SummaryItem label="Thái độ & phối hợp" value={task.completion_score ? `${task.completion_score.collaboration_score}/20` : "—"} /><SummaryItem label="Chủ động & trách nhiệm" value={task.completion_score ? `${task.completion_score.initiative_score}/20` : "—"} /><SummaryItem label="Tổng điểm" value={task.completion_score ? `${task.completion_score.total_score}/100` : "—"} /></dl></div><div className="mt-3 text-right"><Link href={`/tasks/${task.id}`} className="text-sm font-semibold text-orange-700 underline">Mở chi tiết đầy đủ</Link></div></td></tr> : null}</Fragment>;
                      })}</tbody>
                    </table>
                    </div>
                    <div className="space-y-3 lg:hidden">{tasks.items.map((task) => {
                      const canEdit = task.compatibility_task_type === "personal" && !task.legacy_read_only && task.owner_id === currentUserId;
                      const canClaim = canClaimTasks && task.self_claimable && task.status === "new" && task.assignee_id === null;
                      return <article key={task.id} className="rounded-xl border p-4"><Link href={`/tasks/${task.id}`} className="font-bold">{task.title}</Link><dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-slate-500">Tính chất</dt><dd>{task.compatibility_task_type === "personal" ? "Nhiệm vụ cá nhân" : "Công việc được giao"}</dd></div><div><dt className="text-slate-500">Trạng thái</dt><dd><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(task.status)}`}>{taskStatusLabel(task.status)}</span></dd></div><div><dt className="text-slate-500">Hạn hoàn thành</dt><dd>{dueText(task.due_date, task.due_time)}</dd></div><div><dt className="text-slate-500">Thời hạn</dt><dd>{deadlineLabel(task)}</dd></div></dl><div className="mt-3"><PersonalTaskActions taskId={task.id} canEdit={canEdit} canClaim={canClaim} terminal={["done","cancelled"].includes(task.status)} /></div></article>;
                    })}</div>
                  </>
                ) : null}
                <nav aria-label="Phân trang" className="mt-4 flex items-center justify-between border-t pt-4 text-sm"><span>Trang {tasks.page}/{totalPages} · {tasks.total} công việc</span><div className="flex gap-2">{tasks.page > 1 ? <Link className="rounded border px-3 py-2" href={listHref({ page: tasks.page - 1 })}>Trước</Link> : null}{tasks.page < totalPages ? <Link className="rounded border px-3 py-2" href={listHref({ page: tasks.page + 1 })}>Sau</Link> : null}</div></nav>
              </section>
          </>
        </main>
      </div>
    </div>
  );
}
