"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import { classifyCalendarTask, type JournalismCalendarQuery } from "@/lib/journalismCalendar";
import type { JournalismCalendarResult, JournalismCalendarTask } from "@/lib/journalismCalendarRepository";

const statusLabels = {
  unplanned: "Chưa xếp lịch", overdue: "Quá hạn", scheduled: "Đã lên lịch", published: "Đã xuất bản", withdrawn: "Đã gỡ",
} as const;
const statusClass = {
  unplanned: "border-slate-200 bg-slate-50 text-slate-700", overdue: "border-red-200 bg-red-50 text-red-800", scheduled: "border-blue-200 bg-blue-50 text-blue-800", published: "border-emerald-200 bg-emerald-50 text-emerald-800", withdrawn: "border-amber-200 bg-amber-50 text-amber-900",
} as const;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Chưa có ngày";

type Props = { userLabel: string; query: JournalismCalendarQuery; data: JournalismCalendarResult; };

export default function JournalismCalendarShell({ userLabel, query, data }: Props) {
  const [tasks, setTasks] = useState(data.tasks);
  const [message, setMessage] = useState("");
  const options = useMemo(() => ({
    reporters: [...new Map(tasks.filter((task) => task.assigneeId).map((task) => [task.assigneeId, { id: task.assigneeId!, name: task.assigneeName ?? task.assigneeId! }])).values()],
    topics: [...new Map(tasks.filter((task) => task.topic).map((task) => [task.topic!.id, task.topic!])).values()],
    series: [...new Map(tasks.filter((task) => task.series).map((task) => [task.series!.id, task.series!])).values()],
  }), [tasks]);
  const groups = useMemo(() => {
    const grouped = new Map<string, JournalismCalendarTask[]>();
    for (const task of tasks) {
      const key = task.plannedPublicationAt?.slice(0, 10) ?? "unplanned";
      grouped.set(key, [...(grouped.get(key) ?? []), task]);
    }
    return [...grouped.entries()].sort(([left], [right]) => left === "unplanned" ? 1 : right === "unplanned" ? -1 : left.localeCompare(right));
  }, [tasks]);
  async function saveDate(taskId: string, value: string) {
    setMessage("");
    const response = await fetch(`/api/journalism/calendar/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plannedPublicationAt: value ? new Date(value).toISOString() : null }) });
    if (!response.ok) { setMessage("Không thể cập nhật ngày dự kiến xuất bản."); return; }
    const next = value ? new Date(value).toISOString() : null;
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, plannedPublicationAt: next } : task));
    setMessage("Đã cập nhật ngày dự kiến xuất bản.");
  }
  const href = (patch: Partial<JournalismCalendarQuery>) => {
    const next = { ...query, ...patch };
    const params = new URLSearchParams({ view: next.view, date: next.anchorDate });
    if (next.reporterId) params.set("reporter", next.reporterId);
    if (next.publicationStatus) params.set("status", next.publicationStatus);
    if (next.topicId) params.set("topic", next.topicId);
    if (next.seriesId) params.set("series", next.seriesId);
    return `/journalism/calendar?${params}`;
  };
  return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6"><div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 lg:flex-row lg:gap-4"><AppNav currentPath="/journalism/calendar" userLabel={userLabel} /><main className="min-w-0 flex-1 space-y-3">
    <header className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-orange-600">Journalism · J7 Lite</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">Lịch biên tập phòng Nội dung</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Lập kế hoạch thủ công theo ngày dự kiến xuất bản của Journalism Task. Dữ liệu chỉ trong phạm vi phòng Nội dung.</p></header>
    <div className="flex flex-wrap gap-2 rounded-xl border bg-white p-3 shadow-sm">{(["day", "week", "month"] as const).map((view) => <Link key={view} href={href({ view })} className={`rounded-lg px-3 py-2 text-sm font-semibold ${query.view === view ? "bg-orange-500 text-white" : "border bg-white"}`}>{view === "day" ? "Ngày" : view === "week" ? "Tuần" : "Tháng"}</Link>)}<form method="get" className="flex flex-wrap gap-2"><input type="hidden" name="view" value={query.view} /><input type="date" name="date" defaultValue={query.anchorDate} className="rounded-lg border px-3 py-2 text-sm" /><select name="reporter" defaultValue={query.reporterId ?? ""} className="rounded-lg border bg-white px-3 py-2 text-sm"><option value="">Tất cả phóng viên</option>{options.reporters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select name="status" defaultValue={query.publicationStatus ?? ""} className="rounded-lg border bg-white px-3 py-2 text-sm"><option value="">Mọi trạng thái xuất bản</option><option value="not_published">Chưa xuất bản</option><option value="scheduled">Đã lên lịch</option><option value="published">Đã xuất bản</option><option value="withdrawn">Đã gỡ</option></select><select name="topic" defaultValue={query.topicId ?? ""} className="rounded-lg border bg-white px-3 py-2 text-sm"><option value="">Mọi Topic</option>{options.topics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select name="series" defaultValue={query.seriesId ?? ""} className="rounded-lg border bg-white px-3 py-2 text-sm"><option value="">Mọi Series</option>{options.series.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Lọc</button></form></div>
    {message ? <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
    <section className="rounded-xl border bg-white p-3 shadow-sm"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-bold">{data.from} → {data.to}</h2><p className="text-xs text-slate-500">{tasks.length} Journalism Task trong phạm vi được phép xem.</p></div><div className="flex flex-wrap gap-1 text-xs">{Object.entries(statusLabels).map(([status, label]) => <span key={status} className={`rounded-full border px-2 py-1 ${statusClass[status as keyof typeof statusClass]}`}>{label}</span>)}</div></div><div className="space-y-3">{groups.map(([date, items]) => <div key={date} className="rounded-lg border p-3"><h3 className="font-semibold">{date === "unplanned" ? "Chưa xếp lịch" : date}</h3><div className="mt-2 grid gap-2">{items.map((task) => { const status = classifyCalendarTask({ plannedPublicationAt: task.plannedPublicationAt, publicationStatus: task.publicationStatus as any }, today); return <article key={task.id} className={`rounded-lg border p-3 ${statusClass[status]}`}><div className="flex flex-wrap items-start justify-between gap-2"><div><Link href={`/tasks/${task.id}`} className="font-semibold underline">{task.title}</Link><p className="mt-1 text-xs">{task.assigneeName ?? "Chưa gán phóng viên"}{task.topic ? ` · Topic: ${task.topic.name}` : ""}{task.series ? ` · Series: ${task.series.name}` : ""}</p><p className="mt-1 text-xs">{statusLabels[status]} · {dateLabel(task.plannedPublicationAt)}</p></div><form onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.elements.namedItem("planned") as HTMLInputElement; void saveDate(task.id, input.value); }} className="flex items-center gap-2"><input name="planned" type="datetime-local" defaultValue={task.plannedPublicationAt ? task.plannedPublicationAt.slice(0, 16) : ""} className="rounded border bg-white px-2 py-1 text-xs" aria-label={`Ngày dự kiến xuất bản cho ${task.title}`} /><button className="rounded bg-white px-2 py-1 text-xs font-semibold ring-1 ring-slate-300">Lưu ngày</button></form></div></article>; })}</div></div>)}{!groups.length ? <p className="p-8 text-center text-sm text-slate-500">Chưa có Journalism Task phù hợp.</p> : null}</div></section>
  </main></div></div>;
}
