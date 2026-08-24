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
  new: "Mới", in_progress: "Đang làm", blocked: "Có vướng mắc", waiting: "Chờ phối hợp",
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
  const [evaluationText, setEvaluationText] = useState("");
  const [leaderEvaluationText, setLeaderEvaluationText] = useState("");
  const [evaluationDeadline, setEvaluationDeadline] = useState(task.due_date ?? today());
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
  const submitEvaluation = async (event: FormEvent) => {
    event.preventDefault();
    const response = await jsonPost(`/api/tasks/${task.id}/evaluations`, { evaluationText, evaluationDeadline, evaluationSource: "chatgpt" });
    if (response) setEvaluationText("");
  };
  const submitLeaderEvaluation = async (event: FormEvent) => {
    event.preventDefault();
    const response = await jsonPost(`/api/tasks/${task.id}/evaluations`, { evaluationText: leaderEvaluationText, evaluationDeadline, evaluationSource: "leader" });
    if (response) setLeaderEvaluationText("");
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

  return <div className="min-h-screen bg-slate-50 px-3 py-3 text-slate-900 sm:px-4 lg:px-6">
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 lg:flex-row lg:gap-4">
      <AppNav currentPath={`/tasks/${task.id}`} userLabel={userLabel} onLogout={logout} />
      <main className="min-w-0 flex-1 space-y-2.5">
        <header className="rounded-2xl border bg-white px-4 py-4 shadow-sm sm:px-5">
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0"><h1 className="break-words text-xl font-bold leading-tight sm:text-2xl">{task.title}</h1><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600"><span><b>Hạn:</b> {dueText(task)}</span><span>{deadlineState}</span></div></div>
            <div className="flex shrink-0 flex-wrap items-center gap-2"><span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-800">{statusLabel[task.status] ?? task.status}</span>{canComplete ? <button data-testid="task-completion-action" disabled={busy} onClick={() => jsonPost(`/api/tasks/${task.id}/${completePath}`)} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Hoàn thành</button> : null}</div>
          </div>
        </header>
        {message ? <p role="status" className="rounded-lg border bg-white p-3 text-sm">{message}</p> : null}

        <div className="grid items-start gap-2.5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-2.5">
            <section aria-label="Tổng quan" className="space-y-2.5">
              <Section title="Tổng quan"><p className="whitespace-pre-wrap leading-7">{task.description || "—"}</p></Section>
              {task.status === "rejected" ? <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"><h2 className="font-bold">Lý do trả lại</h2><p className="mt-2 whitespace-pre-wrap text-sm">{returnReason || "Chưa ghi nhận lý do."}</p></section> : null}
              <Section title={`Đính kèm · Tệp (${task.attachments.length})`}>
                {capabilities.attachment ? <form onSubmit={upload} className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"><input name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" className="min-w-0 rounded border bg-white p-2 text-sm" /><button disabled={busy} className="rounded bg-orange-600 px-4 py-2 text-sm font-semibold text-white">Tải lên</button></form> : null}
                <Timeline empty="Chưa có tệp.">{task.attachments.map((row) => <li key={row.id} className="break-words"><span>{row.file_name} · {Math.ceil(row.size_bytes / 1024)} KB</span><button onClick={() => download(row.id)} className="mt-1 block text-orange-700 underline">Tải xuống</button></li>)}</Timeline>
              </Section>
              <Section title="Tiêu chí đánh giá"><p className="whitespace-pre-wrap text-sm leading-6">{task.evaluation_criteria || "Chưa có tiêu chí đánh giá."}</p></Section>
              <Section title="Trao đổi">{capabilities.comment ? <form onSubmit={submitComment} className="mb-5 flex flex-col gap-2 sm:flex-row"><input value={comment} onChange={(event) => setComment(event.target.value)} required maxLength={5000} placeholder="Viết bình luận" className="min-w-0 flex-1 rounded border p-2" /><button disabled={busy} className="rounded bg-orange-600 px-4 py-2 font-semibold text-white">Gửi</button></form> : null}{task.comments.length ? <ul aria-label="Danh sách trao đổi, mới nhất trước" className="max-h-64 space-y-3 overflow-y-auto border-l-2 border-orange-100 pl-4 pr-2 text-sm">{task.comments.map((row) => <li key={row.id} className="border-b border-slate-100 pb-3 last:border-0"><b>{row.staff_users?.full_name ?? "Người dùng"}</b> · {dateText(row.created_at)}<p className="mt-1 whitespace-pre-wrap break-words">{row.content}</p></li>)}</ul> : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Chưa có trao đổi.</p>}</Section>
              <section id="task-evaluation-workspace" tabIndex={-1} aria-label="Đánh giá công việc" className="scroll-mt-4 focus:outline-none">
                <Section title="Đánh giá công việc">
                  {capabilities.evaluate ? <form onSubmit={submitEvaluation} className="mb-5 grid gap-3"><label className="grid gap-1 text-sm font-semibold">Thời hạn đánh giá<input aria-label="Thời hạn đánh giá" type="date" value={evaluationDeadline} onChange={(event) => setEvaluationDeadline(event.target.value)} required className="rounded border p-2 font-normal" /></label><details className="rounded-lg border border-dashed bg-slate-50 p-3" open><summary className="cursor-pointer text-sm font-semibold">Dán đánh giá từ ChatGPT</summary><textarea id="task-ai-evaluation" aria-label="Nội dung đánh giá từ ChatGPT" value={evaluationText} onChange={(event) => setEvaluationText(event.target.value)} required maxLength={10000} placeholder="Dán nội dung đánh giá đã được ChatGPT soạn sẵn" className="mt-3 min-h-28 w-full rounded border p-2" /><p className="mt-1 text-xs text-slate-500">Kiểm tra nội dung trước khi lưu. Nội dung sẽ được lưu như đánh giá định tính của bạn.</p></details><button disabled={busy} className="rounded bg-orange-600 px-4 py-2 font-semibold text-white sm:justify-self-start">Lưu đánh giá</button></form> : null}
                  {capabilities.leaderEvaluate ? <form onSubmit={submitLeaderEvaluation} className="mb-5 grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3"><label className="grid gap-1 text-sm font-semibold">Đánh giá của lãnh đạo (Trưởng phòng/Tổng Biên Tập)<textarea aria-label="Đánh giá của lãnh đạo" value={leaderEvaluationText} onChange={(event) => setLeaderEvaluationText(event.target.value)} required maxLength={10000} placeholder="Nhập nhận xét của lãnh đạo về công việc" className="min-h-28 rounded border bg-white p-2 font-normal" /></label><button disabled={busy} className="rounded bg-emerald-700 px-4 py-2 font-semibold text-white sm:justify-self-start">Lưu đánh giá lãnh đạo</button></form> : null}
                  <Timeline empty="Chưa có đánh giá.">{task.qualitative_evaluations.map((row) => <li key={row.id}><b>{dateText(row.evaluation_deadline)} · {row.evaluation_source === "leader" ? "Lãnh đạo" : "ChatGPT"} · {row.evaluator?.full_name ?? "Người đánh giá"}</b><p className="whitespace-pre-wrap">{row.evaluation_text}</p></li>)}</Timeline>
                  {task.legacy_evaluations.length ? <details className="mt-5 rounded-lg border p-3"><summary className="cursor-pointer font-semibold">Đánh giá trước đây ({task.legacy_evaluations.length})</summary><p className="my-2 text-sm text-slate-500">Dữ liệu lịch sử được giữ nguyên và chỉ hiển thị nhận xét.</p><Timeline empty="Chưa có nhận xét cũ.">{task.legacy_evaluations.map((row) => <li key={row.id}><b>Ngày đánh giá: {row.checkpoint_date}</b><p className="whitespace-pre-wrap">{row.opinion || "Không có nhận xét."}</p></li>)}</Timeline></details> : null}
                </Section>
              </section>
            </section>

          </div>

          <aside aria-label="Thông tin nhanh" className="order-first space-y-2.5 lg:order-none lg:sticky lg:top-3">
            <Section title="Thông tin chung"><dl className="grid grid-cols-2 gap-1.5"><Item label="Loại" value={personal ? "Nhiệm vụ cá nhân" : "Công việc được giao"} />{capabilities.update && !["done", "cancelled"].includes(task.status) ? <label className="rounded-lg bg-slate-50 px-2.5 py-1.5"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Độ khó</span><select aria-label="Độ khó công việc" defaultValue={task.priority} disabled={busy} onChange={(event) => request(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ priority: event.target.value }) })} className="mt-1 w-full rounded border bg-white px-2 py-1.5 text-sm"><option value="low">Dễ</option><option value="normal">Trung bình</option><option value="high">Khó</option><option value="urgent">Rất khó</option></select></label> : <Item label="Độ khó" value={difficultyLabel[task.priority] ?? task.priority} />}<Item label="Phụ trách" value={task.owner?.full_name ?? "—"} /><Item label="Người duyệt" value={task.reviewer?.full_name ?? "—"} /><Item label="Phòng ban" value={task.departments?.name ?? "—"} /><Item label="Hạn" value={dueText(task)} /><Item label="Tiến độ" value={latestProgress ? `${reportLabel[latestProgress.report_status] ?? latestProgress.report_status} · ${dateText(latestProgress.reported_on)}` : "Chưa có báo cáo"} /></dl></Section>
            {(capabilities.review || capabilities.update || capabilities.personalCancel || capabilities.personalDeadline || capabilities.assignedCancel || capabilities.adminEdit) ? <Section title="Thao tác"><div className="flex flex-nowrap gap-1 overflow-x-auto pb-1 [&_a]:shrink-0 [&_a]:whitespace-nowrap [&_a]:px-2 [&_a]:py-1.5 [&_a]:text-xs [&_button]:shrink-0 [&_button]:whitespace-nowrap [&_button]:px-2 [&_button]:py-1.5 [&_button]:text-xs">
              {capabilities.adminEdit ? <Link href={`/tasks/${task.id}/admin-edit`} className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Sửa</Link> : null}
              {!personal && capabilities.review && task.status === "pending_review" ? <><button disabled={busy} onClick={() => jsonPost(`/api/tasks/${task.id}/review-completion`, { decision: "approve" })} className="rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Duyệt</button><button disabled={busy} onClick={returnWithDeadline} className="rounded bg-amber-600 px-3 py-2 text-sm font-semibold text-white">Trả lại</button></> : null}
              {personal && capabilities.personalDeadline ? <Link href={`/tasks/personal/${task.id}/edit`} className="rounded border px-3 py-2 text-sm">Đổi ngày</Link> : null}
              {((personal && capabilities.personalCancel) || (!personal && capabilities.assignedCancel && !["done", "cancelled"].includes(task.status))) ? <button disabled={busy} onClick={() => reasonAction(`/api/tasks/${task.id}/${personal ? "cancel" : "cancel-assigned"}`, "Hủy nhiệm vụ")} className="rounded bg-red-700 px-3 py-2 text-sm text-white">Hủy</button> : null}
              {!personal && capabilities.update && !["done", "cancelled"].includes(task.status) ? <button disabled={busy} onClick={async () => { const dueDate = window.prompt("Ngày kết thúc mới (YYYY-MM-DD):", task.due_date ?? ""); if (dueDate) await reasonAction(`/api/tasks/${task.id}/deadline-assigned`, "Đổi ngày", { dueDate }); }} className="rounded border px-3 py-2 text-sm">Đổi ngày</button> : null}
            </div></Section> : null}
            <details open className="rounded-xl border bg-white p-4 shadow-sm"><summary className="cursor-pointer font-bold">Tiến độ ({task.progress_reports.length})</summary><div className="mt-3">{capabilities.report && !personal && !["done", "cancelled"].includes(task.status) ? <form onSubmit={submitProgress} className="mb-4 grid gap-2"><input aria-label="Ngày báo cáo" type="date" value={reportedOn} onChange={(event) => setReportedOn(event.target.value)} required className="min-w-0 rounded border p-2 text-sm" /><select aria-label="Trạng thái báo cáo" value={reportStatus} onChange={(event) => setReportStatus(event.target.value)} className="min-w-0 rounded border p-2 text-sm"><option value="in_progress">Đang thực hiện</option><option value="blocked">Có vướng mắc</option><option value="waiting">Đang chờ</option><option value="nearly_done">Sắp xong</option></select><textarea aria-label="Tiến triển" value={progressText} onChange={(event) => setProgressText(event.target.value)} required placeholder="Bạn đã thực hiện được những gì?" className="min-w-0 rounded border p-2 text-sm" /><textarea aria-label="Vướng mắc" value={blockers} onChange={(event) => setBlockers(event.target.value)} required={reportStatus === "blocked"} placeholder="Mô tả vướng mắc (bắt buộc khi chọn Có vướng mắc)" className="min-w-0 rounded border p-2 text-sm" /><button disabled={busy} className="rounded bg-orange-600 px-3 py-2 text-sm font-semibold text-white">Gửi báo cáo</button></form> : null}<Timeline empty="Chưa có báo cáo.">{task.progress_reports.map((row) => <li key={row.id}><b>{dateText(row.reported_on)} · {reportLabel[row.report_status] ?? row.report_status}</b><p className="whitespace-pre-wrap">{row.progress_text}</p>{row.blockers ? <p className="mt-1 text-red-700">Vướng mắc: {row.blockers}</p> : null}</li>)}</Timeline></div></details>
            <details className="rounded-xl border bg-white p-4 shadow-sm"><summary className="cursor-pointer font-bold">Lịch sử ({task.deadline_history.length + task.status_events.length + task.progress_logs.length})</summary><div className="mt-3 space-y-3"><details className="rounded-lg border p-3"><summary className="cursor-pointer font-semibold">Thay đổi hạn ({task.deadline_history.length})</summary><div className="mt-3"><Timeline empty="Chưa đổi hạn.">{task.deadline_history.map((row) => <li key={row.id}>{dateText(row.changed_at)}: {dateText(row.old_due_date)} → {dateText(row.new_due_date)} · {row.reason}</li>)}</Timeline></div></details><details className="rounded-lg border p-3"><summary className="cursor-pointer font-semibold">Trạng thái ({task.status_events.length})</summary><div className="mt-3"><Timeline empty="Chưa có sự kiện.">{task.status_events.map((row) => <li key={row.id}>{dateText(row.created_at)}: {row.from_status ? `${statusLabel[row.from_status] ?? row.from_status} → ` : ""}{statusLabel[row.to_status] ?? row.to_status}{row.reason ? ` · ${row.reason}` : ""}</li>)}</Timeline></div></details><details className="rounded-lg border p-3"><summary className="cursor-pointer font-semibold">Tiến độ cũ ({task.progress_logs.length})</summary><p className="my-2 text-sm text-slate-500">Dữ liệu phần trăm cũ chỉ đọc.</p><Timeline empty="Chưa có dữ liệu cũ.">{task.progress_logs.map((row) => <li key={row.id}>{dateText(row.created_at)} · {row.note || "Cập nhật tiến độ cũ"}</li>)}</Timeline></details></div></details>
          </aside>
        </div>
      </main>
    </div>
  </div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="rounded-xl border bg-white p-3.5 shadow-sm"><h2 className="mb-2 text-base font-bold sm:text-lg">{title}</h2>{children}</section>; }
function Item({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-lg bg-slate-50 px-2.5 py-1.5"><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-0.5 break-words text-sm font-medium text-slate-800">{value}</dd></div>; }
function Timeline({ children, empty }: { children: ReactNode; empty: string }) { const rows = Array.isArray(children) ? children : [children]; return rows.length && rows.some(Boolean) ? <ul className="space-y-3 border-l-2 border-orange-100 pl-4 text-sm">{children}</ul> : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">{empty}</p>; }
