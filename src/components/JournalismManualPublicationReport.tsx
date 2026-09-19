"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JournalismPublicationReportDto } from "@/lib/taskContracts";
import {
  localDateTime,
  manualPublicationError,
  serializeVietnamPublicationTime,
  validatePublicationNote,
  validatePublishedTitle,
  validateReportedPublicationUrl,
} from "@/lib/journalismManualPublicationUi.mjs";
import { formatJournalismDate } from "@/lib/journalismUi.mjs";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";

function currentLocalDateTime() {
  return localDateTime(new Date().toISOString());
}

export default function JournalismManualPublicationReport({
  report,
  taskId,
  canEdit,
}: {
  report: JournalismPublicationReportDto | null;
  taskId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { notify } = useActionFeedback();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const open = () => {
    const local = report ? localDateTime(report.published_at) : currentLocalDateTime();
    setUrl(report?.publication_url ?? "");
    setTitle(report?.published_title ?? "");
    setDate(local.date);
    setTime(local.time);
    setNote(report?.note ?? "");
    setError("");
    dialogRef.current?.showModal();
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("input, textarea, button")?.focus());
  };

  const close = () => {
    if (busyRef.current) return;
    dialogRef.current?.close();
    setError("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busyRef.current) return;
    const parsedUrl = validateReportedPublicationUrl(url);
    const parsedTitle = validatePublishedTitle(title);
    const parsedTime = serializeVietnamPublicationTime(date, time);
    const parsedNote = validatePublicationNote(note);
    if (!parsedUrl.ok) return setError("URL phải là địa chỉ http/https hợp lệ, không chứa thông tin đăng nhập.");
    if (!parsedTime.ok) return setError("Cần nhập thời gian xuất bản hợp lệ.");
    if (!parsedTitle.ok) return setError("Tiêu đề khi xuất bản không được vượt quá 500 ký tự.");
    if (!parsedNote.ok) return setError("Ghi chú không được vượt quá 5.000 ký tự.");
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/tasks/${taskId}/journalism/publication-report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          publicationUrl: parsedUrl.value,
          publishedTitle: parsedTitle.value,
          publishedAt: parsedTime.value,
          note: parsedNote.value,
          expectedUpdatedAt: report?.updated_at ?? null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string | { code?: string } } | null;
        const code = typeof payload?.error === "string" ? payload.error : payload?.error?.code;
        const mapped = manualPublicationError(response.status, code);
        setError(mapped.message);
        notify("error", mapped.message);
        if (mapped.close) dialogRef.current?.close();
        if (mapped.refresh) router.refresh();
        return;
      }
      const message = report ? "Đã cập nhật thông tin xuất bản." : "Đã ghi nhận xuất bản.";
      notify("success", message);
      dialogRef.current?.close();
      router.refresh();
    } catch {
      const message = "Không thể lưu thông tin xuất bản. Vui lòng thử lại.";
      setError(message);
      notify("error", message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return <section aria-label="Xuất bản" className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 shadow-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-base font-bold sm:text-lg">Xuất bản</h2>
        {!report ? <p className="mt-1 text-sm text-slate-600">Chưa ghi nhận xuất bản.</p> : <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          {report.published_title ? <div><dt className="font-semibold text-slate-500">Tiêu đề khi xuất bản</dt><dd className="whitespace-pre-wrap break-words text-slate-800">{report.published_title}</dd></div> : null}
          <div><dt className="font-semibold text-slate-500">Thời gian xuất bản</dt><dd className="text-slate-800">{formatJournalismDate(report.published_at)}</dd></div>
          <div><dt className="font-semibold text-slate-500">Người ghi nhận</dt><dd className="text-slate-800">{report.reporter?.full_name ?? "Người dùng"}</dd></div>
          <div><dt className="font-semibold text-slate-500">Cập nhật lần cuối</dt><dd className="text-slate-800">{formatJournalismDate(report.updated_at)}</dd></div>
          <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">URL bài đã xuất bản</dt><dd className="break-all"><a href={report.publication_url} target="_blank" rel="noreferrer" className="text-emerald-800 underline">{report.publication_url}</a></dd></div>
          {report.note ? <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">Ghi chú</dt><dd className="whitespace-pre-wrap break-words text-slate-800">{report.note}</dd></div> : null}
        </dl>}
      </div>
      {canEdit ? <button type="button" onClick={open} className="shrink-0 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800">{report ? "Cập nhật thông tin xuất bản" : "Ghi nhận xuất bản"}</button> : null}
    </div>
    <dialog ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="manual-publication-title" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }} className="max-h-[90vh] w-[min(92vw,640px)] overflow-y-auto rounded-2xl border p-0 shadow-xl backdrop:bg-slate-900/40">
      <form onSubmit={submit} className="grid gap-4 p-4 sm:p-6">
        <div><h3 id="manual-publication-title" className="text-lg font-bold">{report ? "Cập nhật thông tin xuất bản" : "Ghi nhận xuất bản"}</h3><p className="mt-1 text-sm text-slate-600">Chỉ ghi nhận thông tin nội bộ trong Thời Đại Work.</p></div>
        <label className="grid gap-1 text-sm font-semibold">URL bài đã xuất bản *<input type="text" inputMode="url" required maxLength={2048} value={url} onChange={(event) => setUrl(event.target.value)} aria-invalid={Boolean(error)} className="rounded-lg border px-3 py-2.5 font-normal" placeholder="https://..." /></label>
        <label className="grid gap-1 text-sm font-semibold">Tiêu đề khi xuất bản<input type="text" maxLength={500} value={title} onChange={(event) => setTitle(event.target.value)} className="rounded-lg border px-3 py-2.5 font-normal" /></label>
        <fieldset className="grid gap-2"><legend className="text-sm font-semibold">Thời gian xuất bản *</legend><div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Ngày<input type="date" required value={date} onChange={(event) => setDate(event.target.value)} className="rounded-lg border px-3 py-2.5 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Giờ<input type="time" required value={time} onChange={(event) => setTime(event.target.value)} className="rounded-lg border px-3 py-2.5 font-normal" /></label></div></fieldset>
        <label className="grid gap-1 text-sm font-semibold">Ghi chú<textarea maxLength={5000} rows={4} value={note} onChange={(event) => setNote(event.target.value)} className="rounded-lg border px-3 py-2.5 font-normal" /></label>
        {error ? <p role="alert" className="text-sm font-medium text-red-700">{error}</p> : null}
        <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-col-reverse gap-2 border-t bg-white px-4 py-3 sm:-mx-6 sm:-mb-6 sm:flex-row sm:justify-end sm:px-6"><button type="button" disabled={busy} onClick={close} className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-50">Hủy</button><button type="submit" disabled={busy} aria-busy={busy} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Đang lưu..." : "Lưu thông tin"}</button></div>
      </form>
    </dialog>
  </section>;
}
