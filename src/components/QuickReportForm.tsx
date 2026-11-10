"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { TASK_ATTACHMENT_ACCEPT, uploadErrorMessage, validateTaskAttachment } from "@/components/TaskAttachmentUploader";
import type { QuickReportBatchResult } from "@/lib/taskContracts";

const categories = [["computer", "CNTT / Máy tính"], ["network", "Mạng / Internet"], ["printer_device", "Máy in / Thiết bị"], ["facilities", "Điện / Cơ sở vật chất"], ["official_document", "Công văn"], ["administration", "Hành chính"], ["other", "Khác"]] as const;
type Row = { title: string; category: string; startDate: string; completionDate: string; status: "in_progress" | "done"; notes: string; files: File[]; fileErrors: string[] };
type UploadFailure = { rowIndex: number; taskId?: string; fileName: string; message: string };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const emptyRow = (date = today(), category = "other"): Row => ({ title: "", category, startDate: date, completionDate: date, status: "done", notes: "", files: [], fileErrors: [] });

export default function QuickReportForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedReturnTo = searchParams.get("returnTo");
  const returnTo = requestedReturnTo && requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//") ? requestedReturnTo : "/tasks";
  const [defaultDate, setDefaultDate] = useState(today());
  const [defaultCategory, setDefaultCategory] = useState("other");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [failures, setFailures] = useState<UploadFailure[]>([]);
  const [created, setCreated] = useState(false);
  const submitting = useRef(false);
  const locked = busy || created;
  const update = (index: number, patch: Partial<Row>) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const addRow = () => setRows((current) => [...current, emptyRow(defaultDate, defaultCategory)]);
  const removeRow = (index: number) => setRows((current) => current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index));
  const selectFiles = (index: number, selected: File[]) => {
    if (locked) return;
    setRows(current => current.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const files = [...row.files];
      const fileErrors: string[] = [];
      for (const file of selected) {
        const validation = validateTaskAttachment(file);
        if (validation) fileErrors.push(`${file.name}: ${validation}`);
        else if (files.length >= 10) fileErrors.push(`${file.name}: Mỗi công việc được đính kèm tối đa 10 tệp.`);
        else files.push(file);
      }
      return { ...row, files, fileErrors };
    }));
  };
  const submit = async () => {
    if (submitting.current || created) return;
    submitting.current = true;
    setBusy(true); setError("");
    try {
      for (const row of rows) {
        if (row.files.length > 10) throw new Error("Mỗi công việc được đính kèm tối đa 10 tệp.");
        for (const file of row.files) {
          const validation = validateTaskAttachment(file);
          if (validation) throw new Error(`${file.name}: ${validation}`);
        }
      }
      const requestId = globalThis.crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const reportRows = rows.map(({ title, category, startDate, completionDate, status, notes }) => ({ title, category, startDate, completionDate, status, notes }));
      const response = await fetch("/api/tasks/quick-report", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ requestId, rows: reportRows }) });
      const payload = await response.json().catch(() => null) as (Partial<QuickReportBatchResult> & { error?: { code?: string; message?: string } }) | null;
      if (!response.ok) throw new Error(payload?.error?.message ?? (payload?.error?.code ? `Không thể lưu báo cáo (${payload.error.code}).` : "Không thể lưu báo cáo việc phát sinh."));
      setCreated(true);
      const failed: UploadFailure[] = [];
      const total = rows.reduce((count, row) => count + row.files.length, 0);
      let uploaded = 0;
      const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
      // The batch RPC returns one-based ordinals, including idempotent replays.
      for (const [rowIndex, row] of rows.entries()) {
        const taskId = tasks.find(task => task.ordinal === rowIndex + 1)?.id;
        for (const file of row.files) {
          setProgress(`Đang tải tệp (${++uploaded}/${total})`);
          let message = "";
          if (!taskId) message = "Không tìm thấy công việc đã tạo để tải tệp lên. Vui lòng mở danh sách công việc.";
          else {
            try {
              const form = new FormData(); form.set("file", file);
              const upload = await fetch(`/api/tasks/${taskId}/attachments`, { method: "POST", credentials: "same-origin", body: form });
              if (!upload.ok) message = uploadErrorMessage(upload.status);
            } catch { message = "Lỗi kết nối khi tải tệp. Vui lòng thử lại."; }
          }
          if (message) failed.push({ rowIndex, taskId, fileName: file.name, message });
        }
      }
      if (failed.length) { setFailures(failed); return; }
      router.push(returnTo); router.refresh();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Không thể lưu báo cáo việc phát sinh."); }
    finally { submitting.current = false; setBusy(false); setProgress(""); }
  };
  return <main className="min-h-screen bg-[#f4f1ea] px-3 py-6 text-slate-900 sm:px-6"><div className="mx-auto max-w-6xl">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-700">Ghi nhận nhanh</p><h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Báo cáo việc phát sinh</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Công việc không yêu cầu phê duyệt, được ghi nhận để báo cáo.</p></div><button type="button" onClick={() => router.back()} disabled={busy} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Quay lại</button></div>
    <fieldset disabled={locked} className="min-w-0">
    <div className="mb-4 grid gap-3 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm sm:grid-cols-2"><label className="text-sm font-semibold">Ngày mặc định<input type="date" value={defaultDate} onChange={(event) => setDefaultDate(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label><label className="text-sm font-semibold">Nhóm mặc định<select value={defaultCategory} onChange={(event) => setDefaultCategory(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="grid gap-4 p-4">{rows.map((row, index) => <article key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-slate-800">Việc {index + 1}</h2>{rows.length > 1 ? <button type="button" onClick={() => removeRow(index)} className="rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-700">Xóa</button> : null}</div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold sm:col-span-2">Nội dung công việc<input value={row.title} onChange={(event) => update(index, { title: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" maxLength={500} /></label><label className="text-sm font-semibold">Nhóm công việc<select value={row.category} onChange={(event) => update(index, { category: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-semibold">Ngày bắt đầu<input type="date" value={row.startDate} onChange={(event) => update(index, { startDate: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" required /></label><label className="text-sm font-semibold">Ngày hoàn thành<input type="date" value={row.completionDate} onChange={(event) => update(index, { completionDate: event.target.value })} disabled={row.status !== "done"} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal disabled:bg-slate-100" /></label><label className="text-sm font-semibold">Trạng thái<select value={row.status} onChange={(event) => update(index, { status: event.target.value as Row["status"], completionDate: event.target.value === "in_progress" ? "" : row.completionDate || row.startDate })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"><option value="in_progress">Đang xử lý</option><option value="done">Hoàn thành</option></select></label><label className="text-sm font-semibold sm:col-span-2">Kết quả / ghi chú<textarea value={row.notes} onChange={(event) => update(index, { notes: event.target.value })} className="mt-1 min-h-24 w-full rounded-lg border px-3 py-2 font-normal" maxLength={10000} /></label>
          <div className="min-w-0 text-sm sm:col-span-2">
            <label className="grid gap-2 font-semibold">Đính kèm tệp
              <input type="file" multiple accept={TASK_ATTACHMENT_ACCEPT} disabled={locked} className="w-full min-w-0 rounded-lg border bg-white p-2 font-normal" onChange={event => { selectFiles(index, Array.from(event.target.files ?? [])); event.target.value = ""; }} />
            </label>
            <p className="mt-1 text-xs text-slate-500">Tối đa 10 tệp mỗi công việc. PDF, PNG, JPG, JPEG, DOCX, XLSX; tối đa 10 MB/tệp.</p>
            <ul className="mt-2 flex flex-wrap gap-2">{row.files.map((file, fileIndex) => <li key={fileIndex} className="flex max-w-full items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1">
              <span className="min-w-0 break-all">{file.name} · {file.size >= 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(file.size / 1024)} KB`}</span>
              <button type="button" aria-label={`Xóa tệp ${file.name}`} disabled={locked} onClick={() => update(index, { files: row.files.filter((_, i) => i !== fileIndex), fileErrors: [] })} className="shrink-0 rounded-full px-2 py-1 font-bold text-red-700">×</button>
            </li>)}</ul>
            {row.fileErrors.length ? <ul role="alert" className="mt-2 break-words text-red-700">{row.fileErrors.map((message, i) => <li key={i}>{message}</li>)}</ul> : null}
          </div>
        </div></article>)}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50 p-4"><button type="button" onClick={addRow} disabled={rows.length >= 50} className="rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm font-bold text-orange-800 disabled:opacity-50">+ Thêm việc</button><button type="button" onClick={() => void submit()} disabled={locked} className="rounded-lg bg-orange-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50">{busy ? "Đang lưu…" : `Lưu ${rows.length} việc`}</button></div></section>
    </fieldset>
    {progress ? <p role="status" className="mt-3 text-sm font-semibold text-orange-800">{progress}</p> : null}
    {failures.length ? <section role="alert" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <h2 className="font-bold">Đã lưu công việc, nhưng một số tệp chưa tải lên được.</h2>
      <ul className="mt-2 grid gap-2">{failures.map((failure, i) => <li key={i} className="break-words">
        Việc {failure.rowIndex + 1} · {failure.fileName}: {failure.message}{" "}
        <a className="font-semibold underline" href={failure.taskId ? `/tasks/${failure.taskId}` : "/tasks"}>Mở công việc để đính kèm lại</a>
      </li>)}</ul>
      <button type="button" onClick={() => { router.push(returnTo); router.refresh(); }} className="mt-3 rounded-lg border border-amber-400 bg-white px-4 py-2 font-semibold">Đã hiểu, tiếp tục</button>
    </section> : null}
    {error ? <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p> : null}
  </div></main>;
}
