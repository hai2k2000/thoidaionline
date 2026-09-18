"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JournalismTaskDetailDto } from "@/lib/taskContracts";
import { journalismLocalDateTime } from "@/lib/journalismMetadataEdit.mjs";
import { safeJournalismArticleUrl } from "@/lib/journalismUi.mjs";
import { buildPublicationRequest, publicationActions, publicationError, validateArticleUrl, validateSchedule, validateWithdrawalReason } from "@/lib/journalismPublicationUi.mjs";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";

type Action = "schedule" | "cancel_schedule" | "publish" | "withdraw";

const labels: Record<Action, string> = {
  schedule: "Lên lịch xuất bản",
  cancel_schedule: "Hủy lịch xuất bản",
  publish: "Đánh dấu đã xuất bản",
  withdraw: "Gỡ bài",
};

const successMessages: Record<Action, string> = {
  schedule: "Đã lên lịch xuất bản.",
  cancel_schedule: "Đã hủy lịch xuất bản.",
  publish: "Đã đánh dấu bài là đã xuất bản.",
  withdraw: "Đã chuyển bài sang trạng thái Đã gỡ.",
};

export default function JournalismPublicationControls({ journalism, taskId }: { journalism: JournalismTaskDetailDto; taskId: string }) {
  const router = useRouter();
  const { notify } = useActionFeedback();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const planned = journalismLocalDateTime(journalism.planned_publication_at);
  const safeArticleUrl = safeJournalismArticleUrl(journalism.article_url);
  const [action, setAction] = useState<Action | null>(null);
  const [date, setDate] = useState(planned.date);
  const [time, setTime] = useState(planned.time);
  const [articleUrl, setArticleUrl] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const actions = publicationActions(journalism.publication_status) as Action[];

  useEffect(() => {
    setDate(planned.date);
    setTime(planned.time);
  }, [planned.date, planned.time]);

  const open = (nextAction: Action) => {
    setAction(nextAction);
    setDate(planned.date);
    setTime(planned.time);
    setArticleUrl("");
    setReason("");
    setError("");
    dialogRef.current?.showModal();
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("input, textarea, button")?.focus());
  };
  const close = () => {
    if (busyRef.current) return;
    dialogRef.current?.close();
    setAction(null);
    setError("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!action || busyRef.current) return;
    let body: Record<string, unknown> | null = null;
    if (action === "schedule") {
      const result = validateSchedule(date, time);
      if (!result.ok) return setError(result.reason === "past" ? "Thời gian dự kiến xuất bản phải ở tương lai." : "Cần nhập thời gian dự kiến xuất bản để lên lịch.");
      body = buildPublicationRequest(action, { plannedPublicationAt: result.value });
    } else if (action === "publish") {
      const result = validateArticleUrl(articleUrl);
      if (!result.ok) return setError("URL phải là địa chỉ http/https hợp lệ, không chứa thông tin đăng nhập.");
      body = buildPublicationRequest(action, { articleUrl: result.value });
    } else if (action === "withdraw") {
      const result = validateWithdrawalReason(reason);
      if (!result.ok) return setError(reason.trim() ? "Lý do gỡ bài không được vượt quá 2.000 ký tự." : "Vui lòng nhập lý do gỡ bài.");
      body = buildPublicationRequest(action, { reason: result.value });
    } else {
      body = buildPublicationRequest(action, {});
    }
    if (!body) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/tasks/${taskId}/journalism/publication`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string | { code?: string } } | null;
        const code = typeof payload?.error === "string" ? payload.error : payload?.error?.code;
        const mapped = publicationError(response.status, code, action);
        setError(mapped.message);
        notify("error", mapped.message);
        if (mapped.close) dialogRef.current?.close();
        if (mapped.refresh) router.refresh();
        return;
      }
      notify("success", successMessages[action]);
      dialogRef.current?.close();
      router.refresh();
    } catch {
      const message = "Không thể hoàn tất thao tác xuất bản. Vui lòng thử lại.";
      setError(message);
      notify("error", message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (!actions.length) return null;
  return <section aria-label="Thao tác trạng thái xuất bản" className="rounded-xl border border-orange-200 bg-orange-50/60 p-3.5 shadow-sm">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div><h3 className="font-bold text-slate-900">Trạng thái xuất bản</h3><p className="text-sm text-slate-600">Chỉ ghi nhận trạng thái trong Thời Đại Work, không thao tác trực tiếp trên CMS.</p></div>
      <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
        {actions.map((item) => <button key={item} type="button" disabled={busy} onClick={() => open(item)} className={`w-full rounded-lg px-3 py-2 text-sm font-semibold sm:w-auto ${item === "withdraw" ? "bg-red-700 text-white hover:bg-red-800" : item === "cancel_schedule" ? "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50" : "bg-orange-600 text-white hover:bg-orange-700"}`}>{labels[item]}</button>)}
      </div>
    </div>
    <dialog ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="journalism-publication-title" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }} className="max-h-[90vh] w-[min(92vw,640px)] overflow-y-auto rounded-2xl border p-0 shadow-xl backdrop:bg-slate-900/40">
      <form onSubmit={submit} className="grid gap-4 p-4 sm:p-6">
        <div><h2 id="journalism-publication-title" className="text-lg font-bold">{action ? labels[action] : "Thay đổi trạng thái xuất bản"}</h2><p className="mt-1 text-sm text-slate-600">Thao tác này chỉ cập nhật trạng thái theo dõi trong Thời Đại Work.</p></div>
        {action === "schedule" ? <fieldset className="grid gap-2"><legend className="font-semibold">Dự kiến xuất bản</legend><div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Ngày<input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? "publication-error" : undefined} className="rounded-lg border px-3 py-2.5 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Giờ<input type="time" value={time} onChange={(event) => setTime(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? "publication-error" : undefined} className="rounded-lg border px-3 py-2.5 font-normal" /></label></div></fieldset> : null}
        {action === "cancel_schedule" ? <div className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-semibold">Hủy lịch xuất bản và đưa trạng thái về Chưa xuất bản?</p>{journalism.planned_publication_at ? <p className="mt-1 text-slate-600">Thời gian đang lên lịch: {new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "medium", timeStyle: "short" }).format(new Date(journalism.planned_publication_at))}</p> : null}</div> : null}
        {action === "publish" ? <><label className="grid gap-1 text-sm font-semibold">URL bài đã xuất bản<input type="text" inputMode="url" value={articleUrl} maxLength={2048} onChange={(event) => setArticleUrl(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? "publication-error" : "publication-url-note"} className="rounded-lg border px-3 py-2.5 font-normal" placeholder="https://thoidai.com.vn/..." /></label><p id="publication-url-note" className="text-sm text-slate-600">URL sẽ được lưu là URL bài đã xuất bản và không thể sửa trong phiên bản hiện tại.</p>{journalism.planned_publication_at ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Dự kiến đã ghi nhận: {new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "medium", timeStyle: "short" }).format(new Date(journalism.planned_publication_at))}</p> : null}</> : null}
        {action === "withdraw" ? <><div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"><p className="font-semibold">Gỡ bài khỏi trạng thái đã xuất bản?</p><p>Lý do sẽ được ghi vào lịch sử. Thao tác này không xóa bài khỏi website bên ngoài.</p>{safeArticleUrl ? <div className="mt-2"><span className="font-semibold">URL bài đã xuất bản</span><a href={safeArticleUrl} target="_blank" rel="noreferrer" className="block break-all underline">{safeArticleUrl}</a></div> : null}</div><label className="grid gap-1 text-sm font-semibold">Lý do gỡ bài<textarea value={reason} rows={5} maxLength={2000} onChange={(event) => setReason(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? "publication-error" : undefined} className="rounded-lg border px-3 py-2.5 font-normal" /></label></> : null}
        {error ? <p id="publication-error" role="alert" className="text-sm font-medium text-red-700">{error}</p> : null}
        <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-col-reverse gap-2 border-t bg-white px-4 py-3 sm:-mx-6 sm:-mb-6 sm:flex-row sm:justify-end sm:px-6"><button type="button" disabled={busy} onClick={close} className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-50">Hủy</button><button type="submit" disabled={busy} aria-busy={busy} className={`rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50 ${action === "withdraw" ? "bg-red-700" : "bg-orange-600"}`}>{busy ? "Đang xử lý..." : action ? labels[action] : "Xác nhận"}</button></div>
      </form>
    </dialog>
  </section>;
}
