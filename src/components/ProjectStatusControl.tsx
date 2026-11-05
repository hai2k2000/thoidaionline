"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@/lib/projectRepository";

const button = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50";

export default function ProjectStatusControl({ project, disabled = false }: { project: Project; disabled?: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reopening = project.status === "closed";
  const label = reopening ? "Mở lại dự án" : "Đóng dự án";
  const closedDate = project.closed_at ? new Date(project.closed_at).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }) : null;

  function openDialog() {
    setAcknowledged(false);
    setError("");
    dialogRef.current?.showModal();
    cancelRef.current?.focus();
  }

  function dismiss() {
    if (submitting.current) return;
    dialogRef.current?.close();
    triggerRef.current?.focus();
  }

  async function confirm() {
    if (submitting.current || disabled || (!reopening && !acknowledged)) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: reopening ? "reopen" : "close" }),
      });
      if (!response.ok) {
        // rpcFailure maps SQLSTATE 55000 to the existing conflict/409 contract.
        throw new Error(response.status === 409 && reopening ? "Dự án đang hoạt động. Hãy tải lại trang để cập nhật trạng thái." : response.status === 403 ? "Bạn không có quyền thực hiện thao tác này." : "Không thể cập nhật trạng thái dự án. Vui lòng thử lại.");
      }
      dialogRef.current?.close();
      triggerRef.current?.focus();
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể cập nhật trạng thái dự án. Vui lòng thử lại.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <div className="mt-3">
    {reopening ? <p className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{closedDate ? `Dự án đã đóng ngày ${closedDate}` : "Dự án đã đóng"}</p> : null}
    <button ref={triggerRef} type="button" disabled={disabled || busy} onClick={openDialog} className={`${button} ${reopening ? "text-orange-700" : "text-rose-700"}`}>{label}</button>
    <dialog ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={busy} onCancel={event => { event.preventDefault(); dismiss(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-900/50 sm:p-6">
      <h2 id={titleId} className="break-words text-lg font-bold">{label} «{project.name}»?</h2>
      <p id={descriptionId} className="mt-3 text-sm leading-6 text-slate-600">{reopening ? "Dự án sẽ hoạt động trở lại và có thể giao việc mới." : "Dự án sẽ chuyển sang trạng thái đã đóng và không thể giao việc mới. Trưởng dự án hoặc Admin có thể mở lại dự án sau này."}</p>
      {!reopening ? <label className="mt-4 flex items-start gap-3 text-sm font-medium"><input type="checkbox" required checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-rose-600" />Tôi hiểu và muốn đóng dự án này</label> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : null}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button ref={cancelRef} type="button" disabled={busy} onClick={dismiss} className={`${button} border-slate-300`}>Hủy</button>
        <button type="button" disabled={busy || (!reopening && !acknowledged)} onClick={() => void confirm()} className={`${button} ${reopening ? "border-orange-600 bg-orange-700" : "border-rose-600 bg-rose-600"} text-white`}>{busy ? "Đang xử lý…" : label}</button>
      </div>
    </dialog>
  </div>;
}
