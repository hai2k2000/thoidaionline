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
import { formatJournalismDate, journalismLabels } from "@/lib/journalismUi.mjs";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";

function currentLocalDateTime() {
  return localDateTime(new Date().toISOString());
}

export default function JournalismManualPublicationReport({
  report,
  taskId,
  canEdit,
  canVerify,
}: {
  report: JournalismPublicationReportDto | null;
  taskId: string;
  canEdit: boolean;
  canVerify: boolean;
}) {
  const router = useRouter();
  const { notify } = useActionFeedback();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const verificationDialogRef = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const verificationBusyRef = useRef(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [dialogMode, setDialogMode] = useState<"report" | "reconcile">("report");
  const [reconciliationReason, setReconciliationReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [verificationDecision, setVerificationDecision] = useState<"verified" | "rejected">("verified");
  const [verificationNote, setVerificationNote] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [verificationBusy, setVerificationBusy] = useState(false);

  const open = (mode: "report" | "reconcile" = "report") => {
    setDialogMode(mode);
    const local = report ? localDateTime(report.published_at) : currentLocalDateTime();
    setUrl(report?.publication_url ?? "");
    setTitle(report?.published_title ?? "");
    setDate(local.date);
    setTime(local.time);
    setReconciliationReason("");
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

  const openVerification = (decision: "verified" | "rejected") => {
    if (!report || !canVerify) return;
    setVerificationDecision(decision);
    setVerificationNote("");
    setVerificationError("");
    verificationDialogRef.current?.showModal();
    requestAnimationFrame(() => verificationDialogRef.current?.querySelector<HTMLElement>("textarea, button")?.focus());
  };

  const closeVerification = () => {
    if (verificationBusyRef.current) return;
    verificationDialogRef.current?.close();
    setVerificationError("");
  };

  const submitVerification = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!report || !canVerify || verificationBusyRef.current) return;
    const normalizedNote = verificationNote.normalize("NFC").trim();
    if (verificationDecision === "rejected" && !normalizedNote) {
      setVerificationError("Cần nhập lý do từ chối xác minh.");
      return;
    }
    if ([...normalizedNote].length > 5000) {
      setVerificationError("Lý do xác minh không được vượt quá 5.000 ký tự.");
      return;
    }
    verificationBusyRef.current = true;
    setVerificationBusy(true);
    setVerificationError("");
    try {
      const response = await fetch(`/api/tasks/${taskId}/journalism/publication-verification`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision: verificationDecision,
          note: normalizedNote || null,
          expectedReportUpdatedAt: report.updated_at,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string | { code?: string } } | null;
        const code = typeof payload?.error === "string" ? payload.error : payload?.error?.code;
        const message = response.status === 409 || code === "conflict"
          ? "Thông tin xuất bản đã thay đổi. Dữ liệu mới nhất đã được tải lại."
          : response.status === 403 || code === "forbidden"
            ? "Bạn không có quyền xác minh thông tin xuất bản này."
            : "Không thể lưu quyết định xác minh. Vui lòng thử lại.";
        setVerificationError(message);
        notify("error", message);
        if (response.status === 409 || response.status === 403) {
          verificationDialogRef.current?.close();
          router.refresh();
        }
        return;
      }
      notify("success", verificationDecision === "verified" ? "Đã xác nhận thông tin xuất bản." : "Đã ghi nhận từ chối xác minh.");
      verificationDialogRef.current?.close();
      router.refresh();
    } catch {
      const message = "Không thể lưu quyết định xác minh. Vui lòng thử lại.";
      setVerificationError(message);
      notify("error", message);
    } finally {
      verificationBusyRef.current = false;
      setVerificationBusy(false);
    }
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
    const isReconciliation = dialogMode === "reconcile" && Boolean(report);
    const normalizedReason = reconciliationReason.normalize("NFC").trim();
    if (isReconciliation && (!normalizedReason || [...normalizedReason].length > 2000)) return setError("Cần nhập lý do đối soát, tối đa 2.000 ký tự.");
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const endpoint = isReconciliation ? `/api/tasks/${taskId}/journalism/publication-reconciliation` : `/api/tasks/${taskId}/journalism/publication-report`;
      const body = isReconciliation ? { publicationUrl: parsedUrl.value, publishedTitle: parsedTitle.value, publishedAt: parsedTime.value, note: parsedNote.value, expectedUpdatedAt: report?.updated_at ?? null, reason: normalizedReason } : { publicationUrl: parsedUrl.value, publishedTitle: parsedTitle.value, publishedAt: parsedTime.value, note: parsedNote.value, expectedUpdatedAt: report?.updated_at ?? null };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
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
      const message = isReconciliation ? "Đã đối soát và cập nhật thông tin xuất bản." : report ? "Đã cập nhật thông tin xuất bản." : "Đã ghi nhận xuất bản.";
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
          <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-white/70 p-3"><dt className="font-semibold text-slate-500">Trạng thái xác minh</dt><dd className="mt-1 font-semibold text-slate-800">{verificationStatusLabel[report.verification_status]}</dd>
            {report.verification_status === "stale" ? <p className="mt-1 text-xs text-amber-800">Thông tin xuất bản đã được cập nhật sau lần xác minh trước và cần xác minh lại.</p> : null}
            {report.current_verification ? <div className="mt-2 grid gap-1 text-xs text-slate-600"><span>Người xác minh: <b className="text-slate-800">{report.current_verification.verifier?.full_name ?? "Người dùng"}</b></span><span>Thời điểm: {formatJournalismDate(report.current_verification.created_at)}</span>{report.current_verification.note ? <span className="whitespace-pre-wrap break-words">{report.current_verification.decision === "rejected" ? "Lý do từ chối: " : "Ghi chú: "}{report.current_verification.note}</span> : null}</div> : null}
          </div>
        </dl>}
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
        {canEdit ? <button type="button" onClick={() => open()} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800">{report ? "Cập nhật thông tin xuất bản" : "Ghi nhận xuất bản"}</button> : null}
        {report && canEdit ? <button type="button" onClick={() => open("reconcile")} className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100">{journalismLabels.reconciliation} &amp; sửa</button> : null}
        {report && canVerify ? <div className="flex flex-wrap gap-2"><button type="button" onClick={() => openVerification("verified")} className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100">Xác nhận</button><button type="button" onClick={() => openVerification("rejected")} className="rounded-lg border border-amber-700 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100">Từ chối</button></div> : null}
      </div>
    </div>
    <dialog ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="manual-publication-title" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }} className="max-h-[90vh] w-[min(92vw,640px)] overflow-y-auto rounded-2xl border p-0 shadow-xl backdrop:bg-slate-900/40">
      <form onSubmit={submit} className="grid gap-4 p-4 sm:p-6">
        <div><h3 id="manual-publication-title" className="text-lg font-bold">{dialogMode === "reconcile" ? `${journalismLabels.reconciliation} thông tin xuất bản` : report ? "Cập nhật thông tin xuất bản" : "Ghi nhận xuất bản"}</h3><p className="mt-1 text-sm text-slate-600">{dialogMode === "reconcile" ? "Nêu rõ lý do đối soát; lịch sử xác minh trước đó được giữ nguyên." : "Chỉ ghi nhận thông tin nội bộ trong Thời Đại Work."}</p></div>
        <label className="grid gap-1 text-sm font-semibold">URL bài đã xuất bản *<input type="text" inputMode="url" required maxLength={2048} value={url} onChange={(event) => setUrl(event.target.value)} aria-invalid={Boolean(error)} className="rounded-lg border px-3 py-2.5 font-normal" placeholder="https://..." /></label>
        <label className="grid gap-1 text-sm font-semibold">Tiêu đề khi xuất bản<input type="text" maxLength={500} value={title} onChange={(event) => setTitle(event.target.value)} className="rounded-lg border px-3 py-2.5 font-normal" /></label>
        <fieldset className="grid gap-2"><legend className="text-sm font-semibold">Thời gian xuất bản *</legend><div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Ngày<input type="date" required value={date} onChange={(event) => setDate(event.target.value)} className="rounded-lg border px-3 py-2.5 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Giờ<input type="time" required value={time} onChange={(event) => setTime(event.target.value)} className="rounded-lg border px-3 py-2.5 font-normal" /></label></div></fieldset>
        {dialogMode === "reconcile" ? <label className="grid gap-1 text-sm font-semibold">{journalismLabels.reconciliation} lý do *<textarea required maxLength={2000} rows={3} value={reconciliationReason} onChange={(event) => setReconciliationReason(event.target.value)} className="rounded-lg border px-3 py-2.5 font-normal" /></label> : null}
        <label className="grid gap-1 text-sm font-semibold">Ghi chú<textarea maxLength={5000} rows={4} value={note} onChange={(event) => setNote(event.target.value)} className="rounded-lg border px-3 py-2.5 font-normal" /></label>
        {error ? <p role="alert" className="text-sm font-medium text-red-700">{error}</p> : null}
        <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-col-reverse gap-2 border-t bg-white px-4 py-3 sm:-mx-6 sm:-mb-6 sm:flex-row sm:justify-end sm:px-6"><button type="button" disabled={busy} onClick={close} className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-50">Hủy</button><button type="submit" disabled={busy} aria-busy={busy} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Đang lưu..." : "Lưu thông tin"}</button></div>
      </form>
    </dialog>
    {report?.verification_history.length ? <details className="mt-3 rounded-lg border border-slate-200 bg-white/60 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Lịch sử xác minh ({report.verification_history.length})</summary><ol className="mt-3 space-y-3 text-sm">{report.verification_history.map((entry) => <li key={entry.id} className="border-l-2 border-slate-200 pl-3"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><b>{entry.decision === "verified" ? "Đã xác nhận" : "Bị từ chối"}</b><span className="text-xs text-slate-500">{entry.isCurrent ? "Phiên bản hiện tại" : "Phiên bản lịch sử"}</span></div><p className="mt-1 text-xs text-slate-600">{entry.verifier?.full_name ?? "Người dùng"} · {formatJournalismDate(entry.created_at)}</p>{entry.note ? <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-700">{entry.note}</p> : null}</li>)}</ol></details> : null}
    <dialog ref={verificationDialogRef} role="dialog" aria-modal="true" aria-labelledby="publication-verification-title" onCancel={(event) => { event.preventDefault(); closeVerification(); }} onClick={(event) => { if (event.target === event.currentTarget) closeVerification(); }} className="max-h-[90vh] w-[min(92vw,560px)] overflow-y-auto rounded-2xl border p-0 shadow-xl backdrop:bg-slate-900/40">
      <form onSubmit={submitVerification} className="grid gap-4 p-4 sm:p-6"><div><h3 id="publication-verification-title" className="text-lg font-bold">{verificationDecision === "verified" ? "Xác nhận thông tin xuất bản" : "Từ chối xác minh thông tin xuất bản"}</h3><p className="mt-1 text-sm text-slate-600">Quyết định này được lưu vào lịch sử xác minh nội bộ.</p></div><label className="grid gap-1 text-sm font-semibold">{verificationDecision === "rejected" ? "Lý do từ chối *" : "Ghi chú (không bắt buộc)"}<textarea required={verificationDecision === "rejected"} maxLength={5000} rows={5} value={verificationNote} onChange={(event) => setVerificationNote(event.target.value)} className="rounded-lg border px-3 py-2.5 font-normal" /></label>{verificationError ? <p role="alert" className="text-sm font-medium text-red-700">{verificationError}</p> : null}<div className="flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:justify-end"><button type="button" disabled={verificationBusy} onClick={closeVerification} className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-50">Hủy</button><button type="submit" disabled={verificationBusy} aria-busy={verificationBusy} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{verificationBusy ? "Đang lưu..." : verificationDecision === "verified" ? "Xác nhận" : "Từ chối"}</button></div></form>
    </dialog>
  </section>;
}

const verificationStatusLabel: Record<JournalismPublicationReportDto["verification_status"], string> = {
  unverified: "Chưa xác minh",
  verified: "Đã xác minh",
  rejected: "Bị từ chối",
  stale: "Cần xác minh lại",
};
