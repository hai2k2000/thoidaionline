"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import type { TaskDetailDto } from "@/lib/taskContracts";
import { classifyTaskDeadline } from "@/lib/deadlineClassification.mjs";

type Capabilities = {
  report: boolean; review: boolean; update: boolean; comment: boolean;
  attachment: boolean; evaluate: boolean; personalComplete: boolean; personalCancel: boolean; personalDeadline: boolean;
};
type TabId = "overview" | "progress" | "evaluation" | "comments" | "history";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Tổng quan" },
  { id: "progress", label: "Tiến độ" },
  { id: "evaluation", label: "Đánh giá" },
  { id: "comments", label: "Bình luận" },
  { id: "history", label: "Lịch sử" },
];
const statusLabel: Record<string, string> = {
  new: "Mới", in_progress: "Đang làm", blocked: "Có vướng mắc", waiting: "Chờ phối hợp",
  pending_review: "Chờ duyệt", rejected: "Trả lại", done: "Hoàn thành", cancelled: "Đã hủy",
};
const reportLabel: Record<string, string> = {
  in_progress: "Đang thực hiện", blocked: "Bị chặn", waiting: "Đang chờ", nearly_done: "Sắp xong",
};
const difficultyLabel: Record<string, string> = { low: "Dễ", normal: "Vừa", high: "Khó", urgent: "Rất khó" };
const dateText = (value: string | null) => value ? new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined,
}).format(value.includes("T") ? new Date(value) : new Date(`${value}T12:00:00+07:00`)) : "—";
const today = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

export default function TaskDetailShell({ task, capabilities, userLabel }: {
  task: TaskDetailDto; capabilities: Capabilities; userLabel: string;
}) {
  const router = useRouter();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [tabsReady, setTabsReady] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reportedOn, setReportedOn] = useState(today());
  const [reportStatus, setReportStatus] = useState("in_progress");
  const [progressText, setProgressText] = useState("");
  const [blockers, setBlockers] = useState("");
  const [comment, setComment] = useState("");
  const [evaluationText, setEvaluationText] = useState("");
  const [evaluationDeadline, setEvaluationDeadline] = useState(task.due_date ?? today());

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.slice(1);
      if (TABS.some((tab) => tab.id === hash)) setActiveTab(hash as TabId);
      setTabsReady(true);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const activateTab = (id: TabId, focus = false) => {
    setActiveTab(id);
    setTabsReady(true);
    window.history.replaceState(null, "", `#${id}`);
    if (focus) document.getElementById(`task-tab-${id}`)?.focus();
  };
  const handleTabKey = (event: KeyboardEvent<HTMLAnchorElement>, index: number) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    activateTab(TABS[(index + delta + TABS.length) % TABS.length].id, true);
  };
  const request = async (path: string, init: RequestInit) => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(path, init);
      if (!response.ok) throw new Error("Yêu cầu không thành công.");
      setMessage("Đã cập nhật."); router.refresh(); return response;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Có lỗi xảy ra."); return null;
    } finally { setBusy(false); }
  };
  const jsonPost = (path: string, body: object = {}) => request(path, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const reasonAction = async (path: string, label: string, extra: object = {}) => {
    const reason = window.prompt(`Lý do ${label.toLowerCase()}:`);
    if (!reason?.trim()) return setMessage("Vui lòng nhập lý do."), undefined;
    await jsonPost(path, { ...extra, reason });
  };
  const submitProgress = async (event: FormEvent) => {
    event.preventDefault();
    await jsonPost(`/api/tasks/${task.id}/progress-reports`, { reportedOn, reportStatus, progressText, blockers });
    setProgressText(""); setBlockers("");
  };
  const submitComment = async (event: FormEvent) => {
    event.preventDefault(); if (!comment.trim()) return;
    await jsonPost(`/api/tasks/${task.id}/comments`, { content: comment }); setComment("");
  };
  const submitEvaluation = async (event: FormEvent) => {
    event.preventDefault();
    const response = await jsonPost(`/api/tasks/${task.id}/evaluations`, { evaluationText, evaluationDeadline });
    if (response) setEvaluationText("");
  };
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await request(`/api/tasks/${task.id}/attachments`, { method: "POST", body: new FormData(event.currentTarget) });
    event.currentTarget.reset();
  };
  const download = async (id: string) => {
    const response = await request(`/api/tasks/${task.id}/attachments/${id}`, { method: "GET" });
    if (!response) return;
    const payload = await response.json() as { url?: string };
    if (payload.url) window.location.assign(payload.url);
  };
  const personal = task.task_type === "personal";
  const deadlineState = classifyTaskDeadline(task);
  const canComplete = personal ? capabilities.personalComplete : capabilities.report && !["pending_review", "done", "cancelled"].includes(task.status);
  const completePath = personal ? "complete" : "submit-completion";
  const panelHidden = (id: TabId) => tabsReady && activeTab !== id;

  return <div className="min-h-screen bg-slate-50 px-3 py-3 text-slate-900 sm:px-4 lg:px-6">
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 lg:flex-row lg:gap-6">
      <AppNav currentPath={`/tasks/${task.id}`} userLabel={userLabel} onLogout={logout} />
      <main className="min-w-0 flex-1 space-y-3">
        <header className="rounded-2xl border bg-white px-4 py-4 shadow-sm sm:px-5">
          <Link href="/tasks" className="text-sm font-medium text-orange-700">← Công việc</Link>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0"><h1 className="break-words text-xl font-bold leading-tight sm:text-2xl">{task.title}</h1><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600"><span><b>Hạn:</b> {dateText(task.due_date)}</span><span>{deadlineState}</span></div></div>
            <div className="flex shrink-0 flex-wrap items-center gap-2"><span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-800">{statusLabel[task.status] ?? task.status}</span>{canComplete ? <button data-testid="task-completion-action" disabled={busy} onClick={() => jsonPost(`/api/tasks/${task.id}/${completePath}`)} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Hoàn thành</button> : null}</div>
          </div>
        </header>
        {message ? <p role="status" className="rounded-lg border bg-white p-3 text-sm">{message}</p> : null}

        <nav aria-label="Điều hướng chi tiết công việc" role="tablist" className="grid grid-cols-2 gap-1 rounded-xl border bg-white p-1 shadow-sm sm:grid-cols-5">
          {TABS.map((tab, index) => <a key={tab.id} id={`task-tab-${tab.id}`} href={`#${tab.id}`} role="tab" aria-selected={activeTab === tab.id} aria-controls={`task-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} onClick={(event) => { event.preventDefault(); activateTab(tab.id); }} onKeyDown={(event) => handleTabKey(event, index)} className={`rounded-lg px-2 py-2 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 ${activeTab === tab.id ? "bg-orange-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{tab.label}</a>)}
        </nav>

        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-3">
            <section id="task-panel-overview" role="tabpanel" aria-labelledby="task-tab-overview" hidden={panelHidden("overview")} className="space-y-3">
              <Section title="Nội dung công việc"><p className="whitespace-pre-wrap leading-7">{task.description || "—"}</p></Section>
              <Section title="Tiêu chí đánh giá"><p className="whitespace-pre-wrap leading-7">{task.evaluation_criteria || "—"}</p></Section>
            </section>

            <section id="task-panel-progress" role="tabpanel" aria-labelledby="task-tab-progress" hidden={panelHidden("progress")}>
              <Section title="Báo cáo tiến triển & vướng mắc">
                {capabilities.report && !personal && !["done", "cancelled"].includes(task.status) ? <form onSubmit={submitProgress} className="mb-5 grid gap-3 sm:grid-cols-2"><input aria-label="Ngày báo cáo" type="date" value={reportedOn} onChange={(event) => setReportedOn(event.target.value)} required className="rounded border p-2" /><select aria-label="Trạng thái báo cáo" value={reportStatus} onChange={(event) => setReportStatus(event.target.value)} className="rounded border p-2"><option value="in_progress">Đang thực hiện</option><option value="blocked">Bị chặn</option><option value="waiting">Đang chờ</option><option value="nearly_done">Sắp xong</option></select><textarea aria-label="Tiến triển" value={progressText} onChange={(event) => setProgressText(event.target.value)} required placeholder="Nội dung tiến triển" className="rounded border p-2 sm:col-span-2" /><textarea aria-label="Vướng mắc" value={blockers} onChange={(event) => setBlockers(event.target.value)} required={reportStatus === "blocked"} placeholder="Vướng mắc (bắt buộc khi bị chặn)" className="rounded border p-2 sm:col-span-2" /><button disabled={busy} className="rounded bg-orange-600 px-4 py-2 font-semibold text-white sm:col-span-2 sm:justify-self-start">Gửi báo cáo</button></form> : null}
                <Timeline empty="Chưa có báo cáo.">{task.progress_reports.map((row) => <li key={row.id}><b>{dateText(row.reported_on)} · {reportLabel[row.report_status] ?? row.report_status}</b><p className="whitespace-pre-wrap">{row.progress_text}</p>{row.blockers ? <p className="mt-1 text-red-700">Vướng mắc: {row.blockers}</p> : null}</li>)}</Timeline>
              </Section>
            </section>

            <section id="task-panel-evaluation" role="tabpanel" aria-labelledby="task-tab-evaluation" hidden={panelHidden("evaluation")}>
              <Section title="Đánh giá công việc">
                {capabilities.evaluate ? <form onSubmit={submitEvaluation} className="mb-5 grid gap-3"><textarea aria-label="Nội dung đánh giá" value={evaluationText} onChange={(event) => setEvaluationText(event.target.value)} required maxLength={10000} placeholder="Nhập nhận xét định tính về kết quả công việc" className="min-h-28 rounded border p-2" /><label className="grid gap-1 text-sm font-semibold">Thời hạn đánh giá<input aria-label="Thời hạn đánh giá" type="date" value={evaluationDeadline} onChange={(event) => setEvaluationDeadline(event.target.value)} required className="rounded border p-2 font-normal" /></label><details className="rounded-lg border border-dashed bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-semibold">Đánh giá bằng AI</summary><textarea id="task-ai-evaluation" aria-label="Đánh giá bằng AI" disabled value="Chưa cấu hình AI" readOnly className="mt-3 min-h-20 w-full rounded border bg-slate-100 p-2 text-slate-500" /><p className="mt-1 text-xs text-slate-500">Chỉ khả dụng sau khi cấu hình nhà cung cấp AI và thông tin xác thực phía máy chủ.</p></details><button disabled={busy} className="rounded bg-orange-600 px-4 py-2 font-semibold text-white sm:justify-self-start">Lưu đánh giá</button></form> : null}
                <Timeline empty="Chưa có đánh giá.">{task.qualitative_evaluations.map((row) => <li key={row.id}><b>{dateText(row.evaluation_deadline)} · {row.evaluator?.full_name ?? "Người đánh giá"}</b><p className="whitespace-pre-wrap">{row.evaluation_text}</p></li>)}</Timeline>
                {task.legacy_evaluations.length ? <details className="mt-5 rounded-lg border p-3"><summary className="cursor-pointer font-semibold">Đánh giá trước đây ({task.legacy_evaluations.length})</summary><p className="my-2 text-sm text-slate-500">Dữ liệu lịch sử được giữ nguyên và chỉ hiển thị nhận xét.</p><Timeline empty="Chưa có nhận xét cũ.">{task.legacy_evaluations.map((row) => <li key={row.id}><b>Ngày đánh giá: {row.checkpoint_date}</b><p className="whitespace-pre-wrap">{row.opinion || "Không có nhận xét."}</p></li>)}</Timeline></details> : null}
              </Section>
            </section>

            <section id="task-panel-comments" role="tabpanel" aria-labelledby="task-tab-comments" hidden={panelHidden("comments")}>
              <Section title="Trao đổi">{capabilities.comment ? <form onSubmit={submitComment} className="mb-5 flex flex-col gap-2 sm:flex-row"><input value={comment} onChange={(event) => setComment(event.target.value)} required maxLength={5000} placeholder="Viết bình luận" className="min-w-0 flex-1 rounded border p-2" /><button disabled={busy} className="rounded bg-orange-600 px-4 py-2 font-semibold text-white">Gửi</button></form> : null}<Timeline empty="Chưa có trao đổi.">{task.comments.map((row) => <li key={row.id}><b>{row.staff_users?.full_name ?? "Người dùng"}</b> · {dateText(row.created_at)}<p className="whitespace-pre-wrap">{row.content}</p></li>)}</Timeline></Section>
            </section>

            <section id="task-panel-history" role="tabpanel" aria-labelledby="task-tab-history" hidden={panelHidden("history")}>
              <Section title="Lịch sử"><div className="space-y-3"><details open className="rounded-lg border p-3"><summary className="cursor-pointer font-semibold">Thay đổi hạn ({task.deadline_history.length})</summary><div className="mt-3"><Timeline empty="Chưa đổi hạn.">{task.deadline_history.map((row) => <li key={row.id}>{dateText(row.changed_at)}: {dateText(row.old_due_date)} → {dateText(row.new_due_date)} · {row.reason}</li>)}</Timeline></div></details><details open className="rounded-lg border p-3"><summary className="cursor-pointer font-semibold">Trạng thái ({task.status_events.length})</summary><div className="mt-3"><Timeline empty="Chưa có sự kiện.">{task.status_events.map((row) => <li key={row.id}>{dateText(row.created_at)}: {row.from_status ? `${statusLabel[row.from_status] ?? row.from_status} → ` : ""}{statusLabel[row.to_status] ?? row.to_status}{row.reason ? ` · ${row.reason}` : ""}</li>)}</Timeline></div></details><details className="rounded-lg border p-3"><summary className="cursor-pointer font-semibold">Tiến độ cũ ({task.progress_logs.length})</summary><p className="my-2 text-sm text-slate-500">Dữ liệu phần trăm cũ chỉ đọc.</p><Timeline empty="Chưa có dữ liệu cũ.">{task.progress_logs.map((row) => <li key={row.id}>{dateText(row.created_at)} · {row.note || "Cập nhật tiến độ cũ"}</li>)}</Timeline></details></div></Section>
            </section>
          </div>

          <aside aria-label="Thông tin nhanh" className="order-first space-y-3 lg:order-none lg:sticky lg:top-3">
            <Section title="Thông tin chung"><dl className="grid grid-cols-2 gap-2 lg:grid-cols-1"><Item label="Loại" value={personal ? "Nhiệm vụ cá nhân" : "Công việc được giao"} /><Item label="Mức độ khó" value={difficultyLabel[task.priority] ?? task.priority} /><Item label="Phụ trách" value={task.owner?.full_name ?? "—"} /><Item label="Người duyệt" value={task.reviewer?.full_name ?? "—"} /><Item label="Phòng ban" value={task.departments?.name ?? "—"} /><Item label="Hạn" value={dateText(task.due_date)} /></dl></Section>
            {(capabilities.review || capabilities.update || capabilities.personalCancel || capabilities.personalDeadline) ? <Section title="Thao tác"><div className="flex flex-wrap gap-2">
              {!personal && capabilities.review && task.status === "pending_review" ? <><button disabled={busy} onClick={() => jsonPost(`/api/tasks/${task.id}/review-completion`, { decision: "approve" })} className="rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Duyệt</button><button disabled={busy} onClick={() => reasonAction(`/api/tasks/${task.id}/review-completion`, "Trả lại", { decision: "return" })} className="rounded bg-amber-600 px-3 py-2 text-sm font-semibold text-white">Trả lại</button></> : null}
              {personal && capabilities.personalDeadline ? <Link href={`/tasks/personal/${task.id}/edit`} className="rounded border px-3 py-2 text-sm">Đổi ngày</Link> : null}
              {((personal && capabilities.personalCancel) || (!personal && capabilities.update && !["done", "cancelled"].includes(task.status))) ? <button disabled={busy} onClick={() => reasonAction(`/api/tasks/${task.id}/${personal ? "cancel" : "cancel-assigned"}`, "Hủy nhiệm vụ")} className="rounded bg-red-700 px-3 py-2 text-sm text-white">Hủy nhiệm vụ</button> : null}
              {!personal && capabilities.update && !["done", "cancelled"].includes(task.status) ? <button disabled={busy} onClick={async () => { const dueDate = window.prompt("Ngày kết thúc mới (YYYY-MM-DD):", task.due_date ?? ""); if (dueDate) await reasonAction(`/api/tasks/${task.id}/deadline-assigned`, "Đổi ngày", { dueDate }); }} className="rounded border px-3 py-2 text-sm">Đổi ngày</button> : null}
            </div></Section> : null}
            <details className="rounded-xl border bg-white p-4 shadow-sm" open={task.attachments.length > 0}><summary className="cursor-pointer font-bold">Đính kèm ({task.attachments.length})</summary>{capabilities.attachment ? <form onSubmit={upload} className="mt-3 grid gap-2"><input name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" className="min-w-0 rounded border bg-white p-2 text-sm" /><button disabled={busy} className="rounded bg-orange-600 px-3 py-2 text-sm font-semibold text-white">Tải lên riêng tư</button></form> : null}<div className="mt-3"><Timeline empty="Chưa có tệp.">{task.attachments.map((row) => <li key={row.id} className="break-words"><span>{row.file_name} · {Math.ceil(row.size_bytes / 1024)} KB</span><button onClick={() => download(row.id)} className="mt-1 block text-orange-700 underline">Tải xuống</button></li>)}</Timeline></div></details>
          </aside>
        </div>
      </main>
    </div>
  </div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="rounded-xl border bg-white p-4 shadow-sm"><h2 className="mb-3 text-base font-bold sm:text-lg">{title}</h2>{children}</section>; }
function Item({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2"><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-0.5 break-words text-sm font-medium text-slate-800">{value}</dd></div>; }
function Timeline({ children, empty }: { children: ReactNode; empty: string }) { const rows = Array.isArray(children) ? children : [children]; return rows.length && rows.some(Boolean) ? <ul className="space-y-3 border-l-2 border-orange-100 pl-4 text-sm">{children}</ul> : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">{empty}</p>; }
