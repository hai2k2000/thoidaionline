"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import type { TaskDetailDto } from "@/lib/taskContracts";
import { classifyTaskDeadline } from "@/lib/deadlineClassification.mjs";
import { errorMessage, responseErrorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";

type Capabilities = {
  report: boolean; completeAssigned: boolean; review: boolean; update: boolean; comment: boolean;
  attachment: boolean; evaluate: boolean; leaderEvaluate: boolean; personalComplete: boolean; personalCancel: boolean; personalDeadline: boolean; assignedCancel: boolean; adminEdit: boolean;
};
const statusLabel: Record<string, string> = {
  new: "Mới", in_progress: "Đang làm", blocked: "Có vướng mắc", waiting: "Đang chờ duyệt",
  pending_review: "Chờ duyệt", rejected: "Trả lại", done: "Hoàn thành", cancelled: "Đã hủy",
};
const difficultyLabel: Record<string, string> = { low: "Dễ", normal: "Trung bình", high: "Khó", urgent: "Rất khó" };
const reportLabel: Record<string, string> = {
  in_progress: "Đang thực hiện", blocked: "Có vướng mắc", waiting: "Đang chờ", nearly_done: "Sắp xong",
};
const dateText = (value: string | null) => value ? new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined,
}).format(value.includes("T") ? new Date(value) : new Date(`${value}T12:00:00+07:00`)) : "—";
const today = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const dueText = (task: Pick<TaskDetailDto, "due_date" | "due_time">) =>
  task.due_date
    ? dateText(task.due_time ? `${task.due_date}T${task.due_time}+07:00` : task.due_date)
    : "—";

export default function TaskDetailShell({ task, capabilities, userLabel }: {
  task: TaskDetailDto; capabilities: Capabilities; userLabel: string;
}) {
  const router = useRouter();
  const { logout } = useAuth();
  const { notify } = useActionFeedback();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reportedOn, setReportedOn] = useState(today());
  const [reportStatus, setReportStatus] = useState("in_progress");
  const [progressText, setProgressText] = useState("");
  const [blockers, setBlockers] = useState("");
  const [comment, setComment] = useState("");
  const [evaluationDeadline, setEvaluationDeadline] = useState(task.due_date ?? today());
  const requirements = (() => { try { const value = JSON.parse(task.evaluation_criteria ?? "[]"); return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; } catch { return []; } })();
  const [requirementResults, setRequirementResults] = useState(requirements.map(() => false));
  const [requirementScore, setRequirementScore] = useState(0);
  const [collaborationScore, setCollaborationScore] = useState(5);
  const [initiativeScore, setInitiativeScore] = useState(5);
  const [scoreNote, setScoreNote] = useState("");
  const request = async (path: string, init: RequestInit) => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(path, init);
      if (!response.ok) throw new Error(await responseErrorMessage(response, "Yêu cầu không thành công."));
      notify("success", "Đã cập nhật thành công."); setMessage("Đã cập nhật."); router.refresh(); return response;
    } catch (error) {
      const text = errorMessage(error, "Có lỗi xảy ra."); notify("error", text); setMessage(text); return null;
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
  const submitScoreAndApprove = async (event: FormEvent) => {
    event.preventDefault();
    await jsonPost(`/api/tasks/${task.id}/review-completion`, { requirementResults: requirementResults.map((achieved, index) => ({ index, achieved })), requirementScore, collaborationScore, initiativeScore, note: scoreNote });
  };
  const returnWithDeadline = async () => {
    const reason = window.prompt("Lý do trả lại:");
    if (!reason?.trim()) return setMessage("Vui lòng nhập lý do."), undefined;
    const response = await jsonPost(`/api/tasks/${task.id}/review-completion`, { decision: "return", reason });
    if (response && capabilities.update) {
      const dueDate = window.prompt("Hạn mới cho bản sửa (YYYY-MM-DD, có thể bỏ trống):", task.due_date ?? "");
      if (dueDate) await jsonPost(`/api/tasks/${task.id}/deadline-assigned`, { dueDate, reason: "Điều chỉnh hạn sau khi trả lại" });
    }
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
  const canComplete = personal ? capabilities.personalComplete : capabilities.completeAssigned;
  const completePath = personal ? "complete" : "submit-completion";
  const latestProgress = task.progress_reports[0] ?? null;
  const returnReason = task.status_events.find((event) => event.to_status === "rejected" && event.reason)?.reason;
  const hasTaskActions = capabilities.review || capabilities.update || capabilities.personalCancel
    || capabilities.personalDeadline || capabilities.assignedCancel || capabilities.adminEdit;

  return <div className="min-h-screen bg-slate-50 px-3 py-3 text-slate-900 sm:px-4 lg:px-6">
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 lg:flex-row lg:gap-4">
      <AppNav currentPath={`/tasks/${task.id}`} userLabel={userLabel} onLogout={logout} />
      <main className="min-w-0 flex-1 space-y-2.5">
        <header className="sticky top-3 z-30 rounded-2xl bg-white/95 px-4 py-4 shadow-sm backdrop-blur sm:px-5">
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0"><h1 className="break-words text-xl font-bold leading-tight sm:text-2xl">{task.title}</h1><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600"><span><b>Hạn:</b> {dueText(task)}</span><span>{deadlineState}</span></div></div>
            <div className="flex max-w-full shrink-0 flex-nowrap items-center gap-1 overflow-x-auto pb-1 sm:justify-end">
              <span className="shrink-0 rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-800">{statusLabel[task.status] ?? task.status}</span>
              {canComplete ? <button data-testid="task-completion-action" disabled={busy} onClick={() => jsonPost(`/api/tasks/${task.id}/${completePath}`)} className="shrink-0 whitespace-nowrap rounded-lg bg-emerald-700 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Hoàn thành</button> : null}
              {hasTaskActions ? <>
                {capabilities.adminEdit ? <Link href={`/tasks/${task.id}/admin-edit`} className="shrink-0 whitespace-nowrap rounded bg-slate-900 px-2 py-1.5 text-xs font-semibold text-white">Sửa</Link> : null}
                {!personal && capabilities.review && task.status === "pending_review" ? <><button disabled={busy} onClick={() => document.getElementById("task-scoring-form")?.scrollIntoView({ behavior: "smooth" })} className="shrink-0 whitespace-nowrap rounded bg-emerald-700 px-2 py-1.5 text-xs font-semibold text-white">Chấm điểm</button><button disabled={busy} onClick={returnWithDeadline} className="shrink-0 whitespace-nowrap rounded bg-amber-600 px-2 py-1.5 text-xs font-semibold text-white">Trả lại</button></> : null}
                {personal && capabilities.personalDeadline ? <Link href={`/tasks/personal/${task.id}/edit`} className="shrink-0 whitespace-nowrap rounded border px-2 py-1.5 text-xs">Đổi ngày</Link> : null}
                {((personal && capabilities.personalCancel) || (!personal && capabilities.assignedCancel && !["done", "cancelled"].includes(task.status))) ? <button disabled={busy} onClick={() => reasonAction(`/api/tasks/${task.id}/${personal ? "cancel" : "cancel-assigned"}`, "Hủy nhiệm vụ")} className="shrink-0 whitespace-nowrap rounded bg-red-700 px-2 py-1.5 text-xs text-white">Hủy</button> : null}
                {!personal && capabilities.update && !["done", "cancelled"].includes(task.status) ? <button disabled={busy} onClick={async () => { const dueDate = window.prompt("Ngày kết thúc mới (YYYY-MM-DD):", task.due_date ?? ""); if (dueDate) await reasonAction(`/api/tasks/${task.id}/deadline-assigned`, "Đổi ngày", { dueDate }); }} className="shrink-0 whitespace-nowrap rounded border px-2 py-1.5 text-xs">Đổi ngày</button> : null}
              </> : null}
            </div>
          </div>
        </header>
        {message ? <p role="status" className="rounded-lg border bg-white p-3 text-sm">{message}</p> : null}

        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_390px] xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="min-w-0 space-y-2.5">
            <section aria-label="Tổng quan" className="space-y-2.5">
              <Section title="Yêu cầu công việc">{requirements.length ? <ul className="list-disc space-y-2 pl-5">{requirements.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="whitespace-pre-wrap leading-7">{task.description || "—"}</p>}</Section>
              {task.status === "rejected" ? <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"><h2 className="font-bold">Lý do trả lại</h2><p className="mt-2 whitespace-pre-wrap text-sm">{returnReason || "Chưa ghi nhận lý do."}</p></section> : null}
              <Section title={`Đính kèm · Tệp (${task.attachments.length})`}>
                {capabilities.attachment ? <form onSubmit={upload} className="mb-4 flex items-center gap-2"><label title="Đính kèm tệp" aria-label="Đính kèm tệp" className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border bg-white text-orange-700 hover:bg-orange-50"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 12v6m-3-3h6"/></svg><input name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" className="sr-only" /></label><button disabled={busy} title="Tải tệp lên" aria-label="Tải tệp lên" className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-600 text-white"><span aria-hidden="true">↑</span></button></form> : null}
                <Timeline empty="Chưa có tệp.">{task.attachments.map((row) => <li key={row.id} className="break-words"><span>{row.file_name} · {Math.ceil(row.size_bytes / 1024)} KB</span><button onClick={() => download(row.id)} className="mt-1 block text-orange-700 underline">Tải xuống</button></li>)}</Timeline>
              </Section>

              {capabilities.review ? <Section title="Chấm điểm hoàn thành"><p className="mb-3 text-sm text-slate-600">Cơ cấu điểm: đáp ứng yêu cầu 60 điểm · thái độ và phối hợp 20 điểm · chủ động và trách nhiệm 20 điểm.</p>{task.status === "pending_review" ? <form id="task-scoring-form" onSubmit={submitScoreAndApprove} className="grid gap-4"><fieldset className="grid gap-2"><legend className="font-semibold">1. Mức độ đáp ứng yêu cầu · tối đa 60 điểm</legend>{requirements.length ? requirements.map((item, index) => <label key={index} className="flex items-start gap-2 rounded-lg border p-3"><input type="checkbox" checked={requirementResults[index]} onChange={(event) => { const next = requirementResults.map((value, itemIndex) => itemIndex === index ? event.target.checked : value); setRequirementResults(next); setRequirementScore(Number((next.filter(Boolean).length * 60 / requirements.length).toFixed(2))); }} className="mt-1" /><span>{item}</span></label>) : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Công việc không có yêu cầu chi tiết; nhập điểm đáp ứng thủ công.</p>}</fieldset><label className="grid gap-1 text-sm font-semibold">Điểm đáp ứng yêu cầu · tự động tính, có thể điều chỉnh<input type="number" min={0} max={60} step={0.01} required value={requirementScore} onChange={(event) => setRequirementScore(Number(event.target.value))} className="rounded border p-2 font-normal" /></label><ScoreField label="2. Thái độ chuyên nghiệp và năng lực phối hợp" value={collaborationScore} onChange={setCollaborationScore} /><ScoreField label="3. Tinh thần chủ động, tiên phong và trách nhiệm" value={initiativeScore} onChange={setInitiativeScore} /><label className="grid gap-1 text-sm font-semibold">Nhận xét<textarea value={scoreNote} onChange={(event) => setScoreNote(event.target.value)} maxLength={2000} className="min-h-20 rounded border p-2 font-normal" /></label><p className="font-bold text-emerald-800">Tổng điểm dự kiến: {(requirementScore + collaborationScore + initiativeScore).toFixed(2)}/100</p><button disabled={busy} className="rounded bg-emerald-700 px-4 py-2 font-semibold text-white sm:justify-self-start">Lưu điểm và duyệt hoàn thành</button></form> : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Chấm điểm sẽ mở khi người thực hiện gửi công việc để duyệt.</p>}</Section> : null}
              {task.completion_score ? <Section title="Kết quả chấm điểm"><div className="grid gap-2 sm:grid-cols-4"><Item label="Đáp ứng yêu cầu" value={`${task.completion_score.requirement_score}/60`} /><Item label="Thái độ & phối hợp" value={`${task.completion_score.collaboration_score}/20`} /><Item label="Chủ động & trách nhiệm" value={`${task.completion_score.initiative_score}/20`} /><Item label="Tổng điểm" value={`${task.completion_score.total_score}/100`} /></div>{task.completion_score.note ? <p className="mt-3 whitespace-pre-wrap text-sm">{task.completion_score.note}</p> : null}</Section> : null}

            </section>

          </div>

          <aside aria-label="Thông tin nhanh" className="order-first space-y-2.5 lg:order-none lg:sticky lg:top-3">
            <Section title="Thông tin chung"><dl className="grid grid-cols-2 gap-1.5"><Item label="Loại" value={personal ? "Nhiệm vụ cá nhân" : "Công việc được giao"} /><Item label="Phụ trách" value={task.owner?.full_name ?? "—"} /><Item label="Người duyệt" value={task.reviewer?.full_name ?? "—"} /><Item label="Phòng ban" value={task.departments?.name ?? "—"} /><Item label="Hạn" value={dueText(task)} /></dl></Section>
            <Section title="Trao đổi"><div className="flex min-h-[360px] flex-col overflow-hidden rounded-xl border bg-slate-50"><div className="flex-1 p-3">{task.comments.length ? <ul aria-label="Danh sách trao đổi" className="max-h-[300px] space-y-3 overflow-y-auto overscroll-contain pr-1">{task.comments.map((row) => <li key={row.id} className="rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 shadow-sm ring-1 ring-slate-100"><div className="flex items-baseline justify-between gap-3"><strong className="text-sm text-slate-800">{row.staff_users?.full_name ?? "Người dùng"}</strong><time className="shrink-0 text-[10px] text-slate-400">{dateText(row.created_at)}</time></div><p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{row.content}</p></li>)}</ul> : <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">Chưa có trao đổi.</p>}</div>{capabilities.comment ? <form onSubmit={submitComment} className="border-t bg-white p-3"><textarea value={comment} onChange={(event) => setComment(event.target.value)} required maxLength={5000} placeholder="Nhập nội dung trao đổi..." className="min-h-20 w-full resize-y rounded-2xl border bg-slate-50 p-3 text-sm leading-6 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100" /><div className="mt-2 flex items-center justify-between gap-2"><label title="Đính kèm tệp" aria-label="Đính kèm tệp" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border bg-white text-slate-600 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 12v6m-3-3h6"/></svg><input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" className="sr-only" /></label><button disabled={busy} className="rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-50">Gửi</button></div></form> : null}</div></Section>
            <details className="rounded-xl border bg-white p-4 shadow-sm"><summary className="sticky top-[7.5rem] z-20 -mx-1 cursor-pointer bg-white px-1 py-1 font-bold">Lịch sử ({task.deadline_history.length + task.status_events.length + task.progress_logs.length})</summary><div className="mt-3 space-y-3"><details className="rounded-lg border p-3"><summary className="cursor-pointer font-semibold">Thay đổi hạn ({task.deadline_history.length})</summary><div className="mt-3"><Timeline empty="Chưa đổi hạn.">{task.deadline_history.map((row) => <li key={row.id}>{dateText(row.changed_at)}: {dateText(row.old_due_date)} → {dateText(row.new_due_date)} · {row.reason}</li>)}</Timeline></div></details><details className="rounded-lg border p-3"><summary className="cursor-pointer font-semibold">Trạng thái ({task.status_events.length})</summary><div className="mt-3"><Timeline empty="Chưa có sự kiện.">{task.status_events.map((row) => <li key={row.id}>{dateText(row.created_at)}: {row.from_status ? `${statusLabel[row.from_status] ?? row.from_status} → ` : ""}{statusLabel[row.to_status] ?? row.to_status}{row.reason ? ` · ${row.reason}` : ""}</li>)}</Timeline></div></details></div></details>
          </aside>
        </div>
      </main>
    </div>
  </div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="rounded-xl border bg-white p-3.5 shadow-sm"><h2 className="sticky top-[7.5rem] z-20 -mx-1 mb-2 bg-white px-1 py-1 text-base font-bold sm:text-lg">{title}</h2>{children}</section>; }
function ScoreField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="grid gap-1 text-sm font-semibold">{label} · tối đa 20 điểm<select required value={value} onChange={(event) => onChange(Number(event.target.value))} className="rounded border bg-white p-2 font-normal">{[5, 10, 15, 20].map((score) => <option key={score} value={score}>{score} điểm</option>)}</select></label>; }
function Item({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-lg bg-slate-50 px-2.5 py-1.5"><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-0.5 break-words text-sm font-medium text-slate-800">{value}</dd></div>; }
function Timeline({ children, empty }: { children: ReactNode; empty: string }) { const rows = Array.isArray(children) ? children : [children]; return rows.length && rows.some(Boolean) ? <ul className="space-y-3 border-l-2 border-orange-100 pl-4 text-sm">{children}</ul> : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">{empty}</p>; }
