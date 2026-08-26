"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import AppNav from "@/components/AppNav";

type Task = { id: string; title: string; status: string; dueDate: string | null; score: number | null };
type Row = { id: string; name: string; department: string; total: number; done: number; returned: number; inProgress: number; waiting: number; overdue: number; completionRate: number; score: number | null; tasks: Task[] };

const statusLabel = (status: string) => ({ new: "Mới", todo: "Chưa bắt đầu", in_progress: "Đang thực hiện", pending_review: "Chờ duyệt", rejected: "Trả lại", done: "Hoàn thành", completed: "Hoàn thành" }[status] ?? status);
const dateLabel = (date: string | null) => date ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(`${date}T00:00:00`)) : "—";

export default function PublicEvaluationSummary({ userLabel }: { userLabel: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [period, setPeriod] = useState("all");
  const [cycles, setCycles] = useState<Array<{ id: string; name: string }>>([]);
  const [cycle, setCycle] = useState("all");
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch(`/api/public-evaluation-summary?period=${period}&cycle=${cycle}`)
      .then((response) => { if (!response.ok) throw new Error("load"); return response.json(); })
      .then((data) => { setRows(data.rows ?? []); setCycles(data.cycles ?? []); })
      .catch(() => setError(true));
  }, [period, cycle]);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await panelRef.current?.requestFullscreen();
  };

  return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 lg:flex-row lg:gap-6">
      <AppNav currentPath="/evaluation-summary" userLabel={userLabel} />
      <main className="min-w-0 flex-1">
        <section ref={panelRef} className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5 fullscreen:overflow-auto fullscreen:p-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-wide text-orange-600">Đánh giá nhân sự</p><h1 className="mt-1 text-2xl font-bold">TỔNG HỢP ĐÁNH GIÁ NHÂN VIÊN</h1><p className="mt-1 text-sm text-slate-600">Bảng công khai cho toàn cơ quan. Chọn một nhân viên để xem các công việc.</p></div>
            <button type="button" onClick={toggleFullscreen} className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-800"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>Toàn màn hình</button>
          </header>
          <div className="mt-4 flex flex-wrap items-center gap-2"><label className="text-sm font-semibold text-slate-600">Kỳ đánh giá</label><select value={cycle} onChange={(e) => { setCycle(e.target.value); setPeriod("all"); setOpen(null); }} className="rounded-xl border bg-white px-3 py-2 text-sm"><option value="all">Tất cả kỳ</option>{cycles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={period} onChange={(e) => { setPeriod(e.target.value); setCycle("all"); setOpen(null); }} className="rounded-xl border bg-white px-3 py-2 text-sm"><option value="all">Tất cả thời gian</option><option value="month">Tháng hiện tại</option><option value="quarter">Quý hiện tại</option><option value="year">Năm hiện tại</option></select></div>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[800px] border-collapse text-sm"><thead><tr className="border-b bg-slate-100 text-left"><th className="p-2">STT</th><th className="p-2">Tên nhân viên</th><th className="p-2 text-center">Tổng số việc</th><th className="p-2 text-center">Hoàn thành</th><th className="p-2 text-center">Đang làm</th><th className="p-2 text-center">Chờ duyệt</th><th className="p-2 text-center">Trả lại</th><th className="p-2 text-center">Quá hạn</th><th className="p-2 text-center">Tỷ lệ HT</th><th className="p-2 text-center">Tổng điểm</th></tr></thead><tbody>{rows.map((row, index) => <Fragment key={row.id}><tr onClick={() => setOpen(open === row.id ? null : row.id)} className="cursor-pointer border-b hover:bg-orange-50"><td className="p-2">{index + 1}</td><td className="p-2 font-semibold">{row.name}<span className="block text-xs font-normal text-slate-500">{row.department}</span></td><td className="p-2 text-center">{row.total}</td><td className="p-2 text-center">{row.done}</td><td className="p-2 text-center">{row.inProgress}</td><td className="p-2 text-center">{row.waiting}</td><td className="p-2 text-center">{row.returned}</td><td className="p-2 text-center">{row.overdue}</td><td className="p-2 text-center">{row.completionRate}%</td><td className="p-2 text-center font-semibold">{row.score ?? "—"}</td></tr>{open === row.id ? <tr className="border-b bg-orange-50/50"><td colSpan={10} className="p-3"><div className="overflow-x-auto rounded-lg border bg-white"><div className="grid min-w-[620px] grid-cols-[1fr_130px_120px_90px] gap-2 border-b bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600"><span>Công việc</span><span>Trạng thái</span><span>Hạn hoàn thành</span><span>Điểm</span></div>{row.tasks.length ? row.tasks.map((task) => <div key={task.id} className="grid min-w-[620px] grid-cols-[1fr_130px_120px_90px] gap-2 border-b px-3 py-2 text-xs last:border-0"><Link href={`/tasks/${task.id}`} className="font-medium hover:text-orange-700 hover:underline">{task.title}</Link><span>{statusLabel(task.status)}</span><span>{dateLabel(task.dueDate)}</span><span>{task.score != null ? task.score : <Link href={`/tasks/${task.id}#task-scoring-form`} className="font-semibold text-orange-700 underline">Chấm điểm</Link>}</span></div>) : <p className="p-3 text-sm text-slate-500">Chưa có công việc.</p>}</div></td></tr> : null}</Fragment>)}</tbody></table>{error ? <p className="p-6 text-center text-red-600">Không thể tải dữ liệu đánh giá. Vui lòng thử lại.</p> : !rows.length ? <p className="p-6 text-center text-slate-500">Chưa có dữ liệu nhân viên.</p> : null}</div>
        </section>
      </main>
    </div>
  </div>;
}
