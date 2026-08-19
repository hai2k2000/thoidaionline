"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PersonnelEvaluationTask } from "@/lib/evaluationRepository";

type TabId = "overview" | "progress" | "comments" | "evaluations" | "history";
const tabs: { id: TabId; label: string }[] = [
  { id: "overview", label: "Tổng quan" }, { id: "progress", label: "Tiến độ" },
  { id: "comments", label: "Bình luận" }, { id: "evaluations", label: "Đánh giá" },
  { id: "history", label: "Lịch sử" },
];
const completionLabels: Record<string,string> = { completed: "Hoàn thành", unfinished: "Chưa hoàn thành" };
const difficultyLabels: Record<string,string> = { low: "Dễ", medium: "Trung bình", high: "Khó", easy: "Dễ", normal: "Trung bình", hard: "Khó", urgent: "Rất khó" };
const deadlineLabels: Record<string,string> = { on_time: "Đúng hạn", overdue: "Quá hạn", in_time: "Trong hạn", no_deadline: "Không có thời hạn" };
const dateText = (value: string | null) => value ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined }).format(value.includes("T") ? new Date(value) : new Date(`${value}T12:00:00+07:00`)) : "—";

function Timeline({ empty, children }: { empty: string; children: React.ReactNode }) {
  const rows = Array.isArray(children) ? children : [children];
  return rows.some(Boolean) ? <ul className="space-y-3 border-l-2 border-orange-100 pl-4 text-sm">{children}</ul> : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">{empty}</p>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border p-4"><h4 className="mb-3 font-bold">{title}</h4>{children}</section>;
}

export default function TaskDetailModal({ task, onClose }: { task: PersonnelEvaluationTask; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  useEffect(() => {
    dialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return <div role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }} className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/50 p-3 sm:p-4">
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="personnel-task-title" tabIndex={-1} className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none">
      <header className="border-b p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-orange-600">Chi tiết công việc</p><h3 id="personnel-task-title" className="mt-1 text-xl font-bold">{task.title}</h3><p className="mt-2 text-sm text-slate-600">{completionLabels[task.completion_status] ?? task.status} · {deadlineLabels[task.deadline_outcome] ?? task.deadline_outcome}</p></div><button type="button" onClick={onClose} aria-label="Đóng chi tiết công việc" className="rounded-lg border px-3 py-1.5 font-bold">×</button></div>
        <nav role="tablist" aria-label="Chi tiết công việc" className="mt-4 flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">{tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold ${activeTab === tab.id ? "bg-white text-orange-700 shadow-sm" : "text-slate-600"}`}>{tab.label}</button>)}</nav>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <aside className="mb-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3"><b>Loại</b><p>{task.task_type === "personal" ? "Nhiệm vụ cá nhân" : "Công việc được giao"}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><b>Mức độ khó</b><p>{difficultyLabels[task.difficulty] ?? task.difficulty}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><b>Phụ trách</b><p>{task.assignee_name ?? task.owner_name ?? "—"}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><b>Người duyệt</b><p>{task.reviewer_name ?? "—"}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><b>Phòng ban</b><p>{task.department_name ?? "—"}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><b>Hạn</b><p>{dateText(task.due_date)}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><b>Tiến độ</b><p>{task.progress_percent}%</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><b>Ngày tạo</b><p>{dateText(task.created_at)}</p></div>
        </aside>
        {activeTab === "overview" ? <div className="space-y-3"><Section title="Nội dung công việc"><p className="whitespace-pre-wrap text-sm leading-7">{task.description || "—"}</p></Section><Section title="Tiêu chí đánh giá"><p className="whitespace-pre-wrap text-sm leading-7">{task.evaluation_criteria || "—"}</p></Section><Section title={`Minh chứng đính kèm (${task.attachments.length})`}><Timeline empty="Chưa có minh chứng đính kèm.">{task.attachments.map((row) => <li key={row.id}>{row.file_name} · {Math.ceil(row.size_bytes / 1024)} KB · {dateText(row.created_at)}</li>)}</Timeline></Section></div> : null}
        {activeTab === "progress" ? <div className="space-y-3"><Section title="Báo cáo tiến triển & vướng mắc"><Timeline empty="Chưa có báo cáo.">{task.progress_reports.map((row) => <li key={row.id}><b>{dateText(row.reported_on)} · {row.report_status}</b><p className="whitespace-pre-wrap">{row.progress_text}</p>{row.blockers ? <p className="text-red-700">Vướng mắc: {row.blockers}</p> : null}</li>)}</Timeline></Section><Section title="Tiến độ cũ"><Timeline empty="Chưa có dữ liệu cũ.">{task.progress_logs.map((row) => <li key={row.id}>{dateText(row.created_at)} · {row.old_progress ?? 0}% → {row.new_progress}%{row.note ? ` · ${row.note}` : ""}</li>)}</Timeline></Section></div> : null}
        {activeTab === "comments" ? <Section title="Trao đổi"><Timeline empty="Chưa có trao đổi.">{task.comments.map((row) => <li key={row.id}><b>{row.author_name ?? "Người dùng"} · {dateText(row.created_at)}</b><p className="whitespace-pre-wrap">{row.content}</p></li>)}</Timeline></Section> : null}
        {activeTab === "evaluations" ? <div className="space-y-3"><Section title="Đánh giá ChatGPT / Lãnh đạo"><Timeline empty="Chưa có đánh giá.">{task.qualitative_evaluations.map((row) => <li key={row.id}><b>{dateText(row.evaluation_deadline)} · {row.evaluation_source === "leader" ? "Lãnh đạo" : "ChatGPT"} · {row.evaluator_name ?? "Người đánh giá"}</b><p className="whitespace-pre-wrap">{row.evaluation_text}</p></li>)}</Timeline></Section><Section title="Đánh giá trước đây"><Timeline empty="Chưa có nhận xét cũ.">{task.legacy_evaluations.map((row) => <li key={row.id}><b>{dateText(row.checkpoint_date)}</b><p className="whitespace-pre-wrap">{row.opinion || "Không có nhận xét."}</p></li>)}</Timeline></Section></div> : null}
        {activeTab === "history" ? <div className="space-y-3"><Section title="Thay đổi hạn"><Timeline empty="Chưa đổi hạn.">{task.deadline_history.map((row) => <li key={row.id}>{dateText(row.changed_at)}: {dateText(row.old_due_date)} → {dateText(row.new_due_date)} · {row.reason}</li>)}</Timeline></Section><Section title="Lịch sử trạng thái"><Timeline empty="Chưa có sự kiện.">{task.status_events.map((row) => <li key={row.id}>{dateText(row.created_at)}: {row.from_status ? `${row.from_status} → ` : ""}{row.to_status}{row.reason ? ` · ${row.reason}` : ""}</li>)}</Timeline></Section></div> : null}
      </div>
      <footer className="flex justify-end gap-2 border-t p-4"><Link href={`/tasks/${task.id}`} target="_blank" rel="noreferrer" className="rounded-lg border px-4 py-2 text-sm font-semibold">Mở trang đầy đủ</Link><button type="button" onClick={onClose} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Đóng</button></footer>
    </section>
  </div>;
}
