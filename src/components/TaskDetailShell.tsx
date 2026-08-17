"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import type { TaskDetailDto } from "@/lib/taskContracts";
import { classifyTaskDeadline } from "@/lib/deadlineClassification.mjs";

type Capabilities = {
  report: boolean; review: boolean; update: boolean; comment: boolean;
  attachment: boolean; evaluate: boolean; personalComplete: boolean; personalCancel: boolean; personalDeadline: boolean;
};

const statusLabel: Record<string, string> = {
  new: "Mới", in_progress: "Đang làm", blocked: "Có vướng mắc",
  waiting: "Chờ phối hợp", pending_review: "Chờ duyệt",
  rejected: "Trả lại", done: "Hoàn thành", cancelled: "Đã hủy",
};
const reportLabel: Record<string, string> = {
  in_progress: "Đang thực hiện", blocked: "Bị chặn", waiting: "Đang chờ", nearly_done: "Sắp xong",
};
const difficultyLabel: Record<string, string> = {
  low: "Dễ", normal: "Vừa", high: "Khó", urgent: "Rất khó",
};
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
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reportedOn, setReportedOn] = useState(today());
  const [reportStatus, setReportStatus] = useState("in_progress");
  const [progressText, setProgressText] = useState("");
  const [blockers, setBlockers] = useState("");
  const [comment, setComment] = useState("");
  const [evaluationText, setEvaluationText] = useState("");
  const [evaluationDeadline, setEvaluationDeadline] = useState(task.due_date ?? today());

  const request = async (path: string, init: RequestInit) => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(path, init);
      if (!response.ok) throw new Error("Yêu cầu không thành công.");
      setMessage("Đã cập nhật.");
      router.refresh();
      return response;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Có lỗi xảy ra.");
      return null;
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
    event.preventDefault();
    if (!comment.trim()) return;
    await jsonPost(`/api/tasks/${task.id}/comments`, { content: comment });
    setComment("");
  };
  const submitEvaluation = async (event: FormEvent) => {
    event.preventDefault();
    const response = await jsonPost(`/api/tasks/${task.id}/evaluations`, {
      evaluationText, evaluationDeadline,
    });
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
  const canComplete = personal
    ? capabilities.personalComplete
    : capabilities.report && !["pending_review", "done", "cancelled"].includes(task.status);
  const completePath = personal ? "complete" : "submit-completion";

  return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 lg:flex-row lg:gap-6">
      <AppNav currentPath={`/tasks/${task.id}`} userLabel={userLabel} onLogout={logout} />
      <main className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-col items-stretch justify-between gap-3 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:p-6"><div><Link href="/tasks" className="text-sm text-orange-700">← Công việc</Link><h1 className="mt-1 text-2xl font-bold">{task.title}</h1></div><div className="flex flex-col items-stretch gap-2 sm:items-end"><span className="rounded-full bg-orange-100 px-3 py-1 text-center text-sm font-semibold text-orange-800">{statusLabel[task.status] ?? task.status}</span>{canComplete ? <button data-testid="task-completion-action" disabled={busy} onClick={() => jsonPost(`/api/tasks/${task.id}/${completePath}`)} className="rounded bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Hoàn thành</button> : null}</div></div>
        {message ? <p role="status" className="rounded-lg border bg-white p-3 text-sm">{message}</p> : null}

        <Section title="Thông tin chung"><dl className="grid gap-3 sm:grid-cols-2"><Item label="Loại" value={personal ? "Nhiệm vụ cá nhân" : "Công việc được giao"} /><Item label="Mức độ khó" value={difficultyLabel[task.priority] ?? task.priority} /><Item label="Phụ trách" value={task.owner?.full_name ?? "—"} /><Item label="Người duyệt" value={task.reviewer?.full_name ?? "—"} /><Item label="Phòng ban" value={task.departments?.name ?? "—"} /><Item label="Hạn" value={dateText(task.due_date)} /><Item label="Phân loại hạn" value={deadlineState} /></dl></Section>
        <Section title="Nội dung công việc"><p className="whitespace-pre-wrap">{task.description || "—"}</p></Section>
        <Section title="Tiêu chí đánh giá"><p className="whitespace-pre-wrap">{task.evaluation_criteria || "—"}</p></Section>
        <Section title="Đánh giá công việc">
          {capabilities.evaluate ? <form onSubmit={submitEvaluation} className="mb-4 grid gap-3"><textarea aria-label="Nội dung đánh giá" value={evaluationText} onChange={(event) => setEvaluationText(event.target.value)} required maxLength={10000} placeholder="Nhập nhận xét định tính về kết quả công việc" className="min-h-28 rounded border p-2" /><label className="grid gap-1 text-sm font-semibold">Thời hạn đánh giá<input aria-label="Thời hạn đánh giá" type="date" value={evaluationDeadline} onChange={(event) => setEvaluationDeadline(event.target.value)} required className="rounded border p-2 font-normal" /></label><div className="rounded-lg border border-dashed bg-slate-50 p-3"><label className="text-sm font-semibold" htmlFor="task-ai-evaluation">Đánh giá bằng AI</label><textarea id="task-ai-evaluation" aria-label="Đánh giá bằng AI" disabled value="Chưa cấu hình AI" readOnly className="mt-2 min-h-20 w-full rounded border bg-slate-100 p-2 text-slate-500" /><p className="mt-1 text-xs text-slate-500">Tính năng chỉ khả dụng sau khi cấu hình nhà cung cấp AI và thông tin xác thực phía máy chủ.</p></div><button disabled={busy} className="rounded bg-orange-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Lưu đánh giá</button></form> : null}
          <Timeline empty="Chưa có đánh giá.">{task.qualitative_evaluations.map((row) => <li key={row.id}><b>{dateText(row.evaluation_deadline)} · {row.evaluator?.full_name ?? "Người đánh giá"}</b><p className="whitespace-pre-wrap">{row.evaluation_text}</p></li>)}</Timeline>
          {task.legacy_evaluations.length ? <div className="mt-4"><h3 className="font-semibold">Đánh giá trước đây</h3><p className="mb-2 text-sm text-slate-500">Dữ liệu lịch sử được giữ nguyên và chỉ hiển thị nhận xét.</p><Timeline empty="Chưa có nhận xét cũ.">{task.legacy_evaluations.map((row) => <li key={row.id}><b>Ngày đánh giá: {row.checkpoint_date}</b><p className="whitespace-pre-wrap">{row.opinion || "Không có nhận xét."}</p></li>)}</Timeline></div> : null}
        </Section>
        <Section title="Báo cáo tiến triển & vướng mắc">
          {capabilities.report && !personal && !["done", "cancelled"].includes(task.status) ? <form onSubmit={submitProgress} className="mb-4 grid gap-3"><input aria-label="Ngày báo cáo" type="date" value={reportedOn} onChange={(e) => setReportedOn(e.target.value)} required className="rounded border p-2" /><select aria-label="Trạng thái báo cáo" value={reportStatus} onChange={(e) => setReportStatus(e.target.value)} className="rounded border p-2"><option value="in_progress">Đang thực hiện</option><option value="blocked">Bị chặn</option><option value="waiting">Đang chờ</option><option value="nearly_done">Sắp xong</option></select><textarea aria-label="Tiến triển" value={progressText} onChange={(e) => setProgressText(e.target.value)} required placeholder="Nội dung tiến triển" className="rounded border p-2" /><textarea aria-label="Vướng mắc" value={blockers} onChange={(e) => setBlockers(e.target.value)} required={reportStatus === "blocked"} placeholder="Vướng mắc (bắt buộc khi bị chặn)" className="rounded border p-2" /><button disabled={busy} className="rounded bg-orange-600 px-4 py-2 text-white">Gửi báo cáo</button></form> : null}
          <Timeline empty="Chưa có báo cáo.">{task.progress_reports.map((row) => <li key={row.id}><b>{dateText(row.reported_on)} · {reportLabel[row.report_status] ?? row.report_status}</b><p className="whitespace-pre-wrap">{row.progress_text}</p>{row.blockers ? <p className="text-red-700">Vướng mắc: {row.blockers}</p> : null}</li>)}</Timeline>
          <div className="mt-4 flex flex-wrap gap-2">
            {!personal && capabilities.review && task.status === "pending_review" ? <><button disabled={busy} onClick={() => jsonPost(`/api/tasks/${task.id}/review-completion`, { decision: "approve" })} className="rounded bg-emerald-700 px-3 py-2 text-white">Duyệt</button><button disabled={busy} onClick={() => reasonAction(`/api/tasks/${task.id}/review-completion`, "Trả lại", { decision: "return" })} className="rounded bg-amber-600 px-3 py-2 text-white">Trả lại</button></> : null}
            {personal && capabilities.personalDeadline ? <Link href={`/tasks/personal/${task.id}/edit`} className="rounded border px-3 py-2">Đổi ngày</Link> : null}
            {((personal && capabilities.personalCancel) || (!personal && capabilities.update && !["done", "cancelled"].includes(task.status))) ? <button disabled={busy} onClick={() => reasonAction(`/api/tasks/${task.id}/${personal ? "cancel" : "cancel-assigned"}`, "Hủy nhiệm vụ")} className="rounded bg-red-700 px-3 py-2 text-white">Hủy nhiệm vụ</button> : null}
            {!personal && capabilities.update && !["done", "cancelled"].includes(task.status) ? <button disabled={busy} onClick={async () => { const dueDate = window.prompt("Ngày kết thúc mới (YYYY-MM-DD):", task.due_date ?? ""); if (dueDate) await reasonAction(`/api/tasks/${task.id}/deadline-assigned`, "Đổi ngày", { dueDate }); }} className="rounded border px-3 py-2">Đổi ngày</button> : null}
          </div>
        </Section>
        <Section title="Trao đổi">{capabilities.comment ? <form onSubmit={submitComment} className="mb-4 flex gap-2"><input value={comment} onChange={(e) => setComment(e.target.value)} required maxLength={5000} placeholder="Viết bình luận" className="min-w-0 flex-1 rounded border p-2" /><button disabled={busy} className="rounded bg-orange-600 px-4 text-white">Gửi</button></form> : null}<Timeline empty="Chưa có trao đổi.">{task.comments.map((row) => <li key={row.id}><b>{row.staff_users?.full_name ?? "Người dùng"}</b> · {dateText(row.created_at)}<p className="whitespace-pre-wrap">{row.content}</p></li>)}</Timeline></Section>
        <Section title="Đính kèm">{capabilities.attachment ? <form onSubmit={upload} className="mb-4 flex flex-wrap gap-2"><input name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" className="rounded border bg-white p-2" /><button disabled={busy} className="rounded bg-orange-600 px-4 text-white">Tải lên riêng tư</button></form> : null}<Timeline empty="Chưa có tệp.">{task.attachments.map((row) => <li key={row.id} className="flex items-center justify-between gap-3"><span>{row.file_name} · {Math.ceil(row.size_bytes / 1024)} KB</span><button onClick={() => download(row.id)} className="text-orange-700 underline">Tải xuống</button></li>)}</Timeline></Section>
        <Section title="Lịch sử"><h3 className="font-semibold">Thay đổi hạn</h3><Timeline empty="Chưa đổi hạn.">{task.deadline_history.map((row) => <li key={row.id}>{dateText(row.changed_at)}: {dateText(row.old_due_date)} → {dateText(row.new_due_date)} · {row.reason}</li>)}</Timeline><h3 className="mt-4 font-semibold">Trạng thái</h3><Timeline empty="Chưa có sự kiện.">{task.status_events.map((row) => <li key={row.id}>{dateText(row.created_at)}: {row.from_status ? `${statusLabel[row.from_status] ?? row.from_status} → ` : ""}{statusLabel[row.to_status] ?? row.to_status}{row.reason ? ` · ${row.reason}` : ""}</li>)}</Timeline><h3 className="mt-4 font-semibold">Tiến độ cũ</h3><p className="text-sm text-slate-500">Dữ liệu phần trăm cũ chỉ đọc.</p><Timeline empty="Chưa có dữ liệu cũ.">{task.progress_logs.map((row) => <li key={row.id}>{dateText(row.created_at)} · {row.note || "Cập nhật tiến độ cũ"}</li>)}</Timeline></Section>
      </main>
    </div>
  </div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="rounded-xl border bg-white p-4 shadow-sm sm:p-5"><h2 className="mb-4 text-lg font-bold">{title}</h2>{children}</section>; }
function Item({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 px-3 py-2"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-800">{value}</dd></div>; }
function Timeline({ children, empty }: { children: ReactNode; empty: string }) { const rows = Array.isArray(children) ? children : [children]; return rows.length && rows.some(Boolean) ? <ul className="space-y-3 border-l-2 border-orange-100 pl-4 text-sm">{children}</ul> : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">{empty}</p>; }
