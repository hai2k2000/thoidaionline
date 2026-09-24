"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JournalismTaskDetailDto } from "@/lib/taskContracts";
import { journalismLabels } from "@/lib/journalismUi.mjs";
import { journalismLocalDateTime, buildJournalismMetadataPatch, validateJournalismMetadataEdit } from "@/lib/journalismMetadataEdit.mjs";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";

type WorkKind = { id: string; name: string; is_active: boolean };

export default function JournalismMetadataEditor({ journalism, taskId, workKinds, workKindsLoadFailed }: { journalism: JournalismTaskDetailDto; taskId: string; workKinds: WorkKind[]; workKindsLoadFailed: boolean }) {
  const router = useRouter();
  const { notify } = useActionFeedback();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const localDateTime = useMemo(() => journalismLocalDateTime(journalism.planned_publication_at), [journalism.planned_publication_at]);
  const initial = useMemo(() => ({ workKindId: journalism.work_kind.id, plannedPublicationAt: journalism.planned_publication_at ?? "", location: journalism.location ?? "", editorialNotes: journalism.editorial_notes ?? "" }), [journalism]);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => setForm(initial), [initial]);
  const lockedPlanned = journalism.publication_status === "published" || journalism.publication_status === "withdrawn";
  const activeKinds = workKinds.filter((kind) => kind.is_active);

  const open = () => {
    setErrors({});
    setForm(initial);
    dialogRef.current?.showModal();
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus());
  };
  const close = () => { if (!busy) dialogRef.current?.close(); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busyRef.current) return;
    const validation = validateJournalismMetadataEdit(form, journalism.publication_status);
    if (Object.keys(validation).length) { setErrors({ ...validation }); return; }
    const patch = buildJournalismMetadataPatch(initial, form, journalism.publication_status);
    if (!patch) { dialogRef.current?.close(); return; }
    busyRef.current = true;
    setBusy(true); setErrors({});
    try {
      const response = await fetch(`/api/tasks/${taskId}/journalism`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { code?: string } | string } | null;
        const code = typeof payload?.error === "string" ? payload.error : payload?.error?.code;
        const message = code === "forbidden" ? "Bạn không có quyền chỉnh sửa thông tin nghiệp vụ." : code === "not_found" ? "Không tìm thấy thông tin nghiệp vụ báo chí." : code === "invalid_request" ? "Dữ liệu gửi lên chưa hợp lệ. Kiểm tra lại các trường được đánh dấu." : "Không thể cập nhật thông tin nghiệp vụ. Vui lòng thử lại.";
        throw new Error(message);
      }
      notify("success", "Đã cập nhật thông tin nghiệp vụ báo chí.");
      dialogRef.current?.close();
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể cập nhật thông tin nghiệp vụ. Vui lòng thử lại.";
      setErrors({ form: message }); notify("error", message);
    } finally { busyRef.current = false; setBusy(false); }
  };

  return <>
    <button type="button" onClick={open} className="rounded-lg border border-orange-300 px-3 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-50">Chỉnh sửa thông tin</button>
    <dialog ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="journalism-metadata-title" className="w-[min(92vw,680px)] rounded-2xl border p-0 shadow-xl backdrop:bg-slate-900/40">
      <form method="dialog" onSubmit={close} className="contents"><button type="submit" className="sr-only">Đóng</button></form>
      <form onSubmit={submit} className="grid gap-4 p-4 sm:p-6">
        <div><h2 id="journalism-metadata-title" className="text-lg font-bold">Chỉnh sửa thông tin nghiệp vụ</h2><p className="mt-1 text-sm text-slate-600">Chỉ cập nhật các trường đã thay đổi.</p></div>
        <label className="grid gap-1 text-sm font-semibold">Loại nghiệp vụ<select disabled={workKindsLoadFailed} value={form.workKindId === journalism.work_kind.id && !journalism.work_kind.is_active ? "" : form.workKindId} onChange={(event) => setForm((current) => ({ ...current, workKindId: event.target.value || current.workKindId }))} className="rounded-lg border px-3 py-2.5"><option value="">{journalism.work_kind.is_active ? "Chọn loại nghiệp vụ" : `${journalism.work_kind.name} (Ngừng sử dụng)`}</option>{activeKinds.map((kind) => <option key={kind.id} value={kind.id}>{kind.name}</option>)}</select>{workKindsLoadFailed ? <span role="alert" className="font-normal text-red-700">Không thể tải loại nghiệp vụ. Hãy tải lại trang.</span> : null}</label>
        <fieldset disabled={lockedPlanned} className="grid gap-1 text-sm font-semibold"><legend>{journalismLabels.plannedPublicationDate}</legend><div className="grid grid-cols-2 gap-2"><label className="grid gap-1 font-normal"><span>Ngày</span><input type="date" aria-label="Ngày dự kiến xuất bản" value={lockedPlanned ? localDateTime.date : journalismLocalDateTime(form.plannedPublicationAt).date} onChange={(event) => setForm((current) => ({ ...current, plannedPublicationAt: combineVietnamDateTime(event.target.value, journalismLocalDateTime(current.plannedPublicationAt).time) }))} className="rounded-lg border px-3 py-2.5" aria-invalid={Boolean(errors.plannedPublicationAt)} aria-describedby={errors.plannedPublicationAt ? "metadata-planned-error" : undefined} /></label><label className="grid gap-1 font-normal"><span>Giờ</span><input type="time" aria-label="Giờ dự kiến xuất bản" value={lockedPlanned ? localDateTimeTime(localDateTime.time) : journalismLocalDateTime(form.plannedPublicationAt).time} onChange={(event) => setForm((current) => ({ ...current, plannedPublicationAt: combineVietnamDateTime(journalismLocalDateTime(current.plannedPublicationAt).date, event.target.value) }))} className="rounded-lg border px-3 py-2.5" aria-invalid={Boolean(errors.plannedPublicationAt)} aria-describedby={errors.plannedPublicationAt ? "metadata-planned-error" : undefined} /></label></div>{lockedPlanned ? <span className="font-normal text-slate-600">Thời gian đã khóa vì trạng thái hiện tại là {journalism.publication_status === "published" ? "Đã xuất bản" : "Đã rút"}.</span> : null}{errors.plannedPublicationAt ? <span id="metadata-planned-error" role="alert" className="font-normal text-red-700">Cần có thời gian dự kiến xuất bản khi trạng thái đang là Đã lên lịch.</span> : null}</fieldset>
        <label className="grid gap-1 text-sm font-semibold">Địa điểm<input value={form.location} maxLength={500} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} aria-invalid={Boolean(errors.location)} aria-describedby={errors.location ? "metadata-location-error" : undefined} className="rounded-lg border px-3 py-2.5 font-normal" />{errors.location ? <span id="metadata-location-error" role="alert" className="font-normal text-red-700">Tối đa 500 ký tự.</span> : null}</label>
        <label className="grid gap-1 text-sm font-semibold">{journalismLabels.editorialNotes}<textarea value={form.editorialNotes} maxLength={10000} rows={5} onChange={(event) => setForm((current) => ({ ...current, editorialNotes: event.target.value }))} aria-invalid={Boolean(errors.editorialNotes)} aria-describedby={errors.editorialNotes ? "metadata-notes-error" : undefined} className="rounded-lg border px-3 py-2.5 font-normal" />{errors.editorialNotes ? <span id="metadata-notes-error" role="alert" className="font-normal text-red-700">Tối đa 10.000 ký tự.</span> : null}</label>
        {errors.form ? <p role="alert" className="text-sm text-red-700">{errors.form}</p> : null}
        <div className="flex justify-end gap-2"><button type="button" onClick={close} disabled={busy} className="rounded-lg border px-4 py-2 font-semibold">Hủy</button><button type="submit" disabled={busy} aria-busy={busy} className="rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Đang lưu..." : "Lưu thay đổi"}</button></div>
      </form>
    </dialog>
  </>;
}

function localDateTimeTime(value: string) { return value || "00:00"; }
function combineVietnamDateTime(date: string, time: string) {
  return date && time ? `${date}T${time}:00+07:00` : "";
}
