"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const categories = [["computer", "CNTT / Máy tính"], ["network", "Mạng / Internet"], ["printer_device", "Máy in / Thiết bị"], ["facilities", "Điện / Cơ sở vật chất"], ["official_document", "Công văn"], ["administration", "Hành chính"], ["other", "Khác"]] as const;
type Row = { title: string; category: string; startDate: string; completionDate: string; status: "in_progress" | "done"; notes: string };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const emptyRow = (date = today(), category = "other"): Row => ({ title: "", category, startDate: date, completionDate: date, status: "done", notes: "" });

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
  const update = (index: number, patch: Partial<Row>) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const addRow = () => setRows((current) => [...current, emptyRow(defaultDate, defaultCategory)]);
  const removeRow = (index: number) => setRows((current) => current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index));
  const submit = async () => {
    setBusy(true); setError("");
    try {
      const requestId = globalThis.crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const response = await fetch("/api/tasks/quick-report", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ requestId, rows }) });
      const payload = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
      if (!response.ok) throw new Error(payload?.error?.message ?? (payload?.error?.code ? `Không thể lưu báo cáo (${payload.error.code}).` : "Không thể lưu báo cáo việc phát sinh."));
      router.push(returnTo); router.refresh();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Không thể lưu báo cáo việc phát sinh."); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-[#f4f1ea] px-3 py-6 text-slate-900 sm:px-6"><div className="mx-auto max-w-6xl">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-700">Ghi nhận nhanh</p><h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Báo cáo việc phát sinh</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Công việc không yêu cầu phê duyệt, được ghi nhận để báo cáo.</p></div><button type="button" onClick={() => router.back()} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Quay lại</button></div>
    <div className="mb-4 grid gap-3 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm sm:grid-cols-2"><label className="text-sm font-semibold">Ngày mặc định<input type="date" value={defaultDate} onChange={(event) => setDefaultDate(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label><label className="text-sm font-semibold">Nhóm mặc định<select value={defaultCategory} onChange={(event) => setDefaultCategory(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="grid gap-4 p-4">{rows.map((row, index) => <article key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-slate-800">Việc {index + 1}</h2>{rows.length > 1 ? <button type="button" onClick={() => removeRow(index)} className="rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-700">Xóa</button> : null}</div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold sm:col-span-2">Nội dung công việc<input value={row.title} onChange={(event) => update(index, { title: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" maxLength={500} /></label><label className="text-sm font-semibold">Nhóm công việc<select value={row.category} onChange={(event) => update(index, { category: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-semibold">Ngày bắt đầu<input type="date" value={row.startDate} onChange={(event) => update(index, { startDate: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" required /></label><label className="text-sm font-semibold">Ngày hoàn thành<input type="date" value={row.completionDate} onChange={(event) => update(index, { completionDate: event.target.value })} disabled={row.status !== "done"} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal disabled:bg-slate-100" /></label><label className="text-sm font-semibold">Trạng thái<select value={row.status} onChange={(event) => update(index, { status: event.target.value as Row["status"], completionDate: event.target.value === "in_progress" ? "" : row.completionDate || row.startDate })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"><option value="in_progress">Đang xử lý</option><option value="done">Hoàn thành</option></select></label><label className="text-sm font-semibold sm:col-span-2">Kết quả / ghi chú<textarea value={row.notes} onChange={(event) => update(index, { notes: event.target.value })} className="mt-1 min-h-24 w-full rounded-lg border px-3 py-2 font-normal" maxLength={10000} /></label></div></article>)}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50 p-4"><button type="button" onClick={addRow} disabled={rows.length >= 50} className="rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm font-bold text-orange-800 disabled:opacity-50">+ Thêm việc</button><button type="button" onClick={() => void submit()} disabled={busy} className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50">{busy ? "Đang lưu…" : `Lưu ${rows.length} việc`}</button></div></section>
    {error ? <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p> : null}
  </div></main>;
}
