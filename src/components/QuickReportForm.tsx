"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Time24hInput from "@/components/Time24hInput";

const categories = [
  ["computer", "CNTT / Máy tính"],
  ["network", "Mạng / Internet"],
  ["printer_device", "Máy in / Thiết bị"],
  ["facilities", "Điện / Cơ sở vật chất"],
  ["official_document", "Công văn"],
  ["administration", "Hành chính"],
  ["other", "Khác"],
] as const;

type Row = { title: string; category: string; workDate: string; startedTime: string; completedTime: string; status: "in_progress" | "done"; notes: string };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const emptyRow = (date = today(), category = "other"): Row => ({ title: "", category, workDate: date, startedTime: "", completedTime: "", status: "done", notes: "" });

export default function QuickReportForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [date, setDate] = useState(today());
  const [defaultCategory, setDefaultCategory] = useState("other");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const update = (index: number, patch: Partial<Row>) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const addRow = () => setRows((current) => [...current, emptyRow(date, defaultCategory)]);
  const removeRow = (index: number) => setRows((current) => current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index));
  const submit = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/tasks/quick-report", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: crypto.randomUUID(), rows }),
      });
      const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      if (!response.ok) throw new Error(payload?.error?.message ?? "Không thể lưu báo cáo việc phát sinh.");
      router.push("/tasks"); router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không thể lưu báo cáo việc phát sinh.");
    } finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-[#f4f1ea] px-3 py-6 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-700">Ghi nhận nhanh</p><h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Báo cáo việc phát sinh</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Công việc cần xử lý ngay, không yêu cầu phê duyệt, được ghi nhận để báo cáo.</p></div>
        <button type="button" onClick={() => router.back()} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Quay lại</button>
      </div>
      <div className="mb-4 flex w-fit rounded-full border border-orange-200 bg-white p-1 shadow-sm"><button type="button" onClick={() => setMode("single")} className={`rounded-full px-4 py-2 text-sm font-bold ${mode === "single" ? "bg-orange-500 text-white" : "text-slate-600"}`}>Một việc</button><button type="button" onClick={() => setMode("batch")} className={`rounded-full px-4 py-2 text-sm font-bold ${mode === "batch" ? "bg-orange-500 text-white" : "text-slate-600"}`}>Nhiều việc</button></div>
      {mode === "batch" ? <div className="mb-4 grid gap-3 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm sm:grid-cols-2"><label className="text-sm font-semibold">Ngày làm việc<input type="date" value={date} onChange={(event) => { setDate(event.target.value); setRows((current) => current.map((row) => row.title ? row : { ...row, workDate: event.target.value })); }} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label><label className="text-sm font-semibold">Nhóm mặc định<select value={defaultCategory} onChange={(event) => setDefaultCategory(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div> : null}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {mode === "single" ? <div className="grid gap-4 p-4 sm:grid-cols-2"><label className="text-sm font-semibold sm:col-span-2">Nội dung công việc<input value={rows[0].title} onChange={(event) => update(0, { title: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" maxLength={500} /></label><label className="text-sm font-semibold">Nhóm công việc<select value={rows[0].category} onChange={(event) => update(0, { category: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-semibold">Ngày thực hiện<input type="date" value={rows[0].workDate} onChange={(event) => update(0, { workDate: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label><label className="text-sm font-semibold">Thời gian bắt đầu<Time24hInput value={rows[0].startedTime} onChange={(event) => update(0, { startedTime: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label><label className="text-sm font-semibold">Thời gian hoàn thành<Time24hInput value={rows[0].completedTime} onChange={(event) => update(0, { completedTime: event.target.value })} disabled={rows[0].status !== "done"} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal disabled:bg-slate-100" /></label><label className="text-sm font-semibold">Trạng thái<select value={rows[0].status} onChange={(event) => update(0, { status: event.target.value as Row["status"], completedTime: event.target.value === "in_progress" ? "" : rows[0].completedTime })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"><option value="in_progress">Đang xử lý</option><option value="done">Hoàn thành</option></select></label><label className="text-sm font-semibold sm:col-span-2">Kết quả / ghi chú<textarea value={rows[0].notes} onChange={(event) => update(0, { notes: event.target.value })} className="mt-1 min-h-24 w-full rounded-lg border px-3 py-2 font-normal" maxLength={10000} /></label></div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Nội dung công việc</th><th className="p-3">Nhóm</th><th className="p-3">Bắt đầu</th><th className="p-3">Hoàn thành</th><th className="p-3">Trạng thái</th><th className="p-3">Kết quả / ghi chú</th><th className="p-3" /></tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t align-top"><td className="p-2"><input value={row.title} onChange={(event) => update(index, { title: event.target.value })} className="w-full rounded border px-2 py-2" maxLength={500} /></td><td className="p-2"><select value={row.category} onChange={(event) => update(index, { category: event.target.value })} className="w-full rounded border px-2 py-2">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td className="p-2"><Time24hInput value={row.startedTime} onChange={(event) => update(index, { startedTime: event.target.value })} className="rounded border px-2 py-2" /></td><td className="p-2"><Time24hInput value={row.completedTime} onChange={(event) => update(index, { completedTime: event.target.value })} disabled={row.status !== "done"} className="rounded border px-2 py-2 disabled:bg-slate-100" /></td><td className="p-2"><select value={row.status} onChange={(event) => update(index, { status: event.target.value as Row["status"], completedTime: event.target.value === "in_progress" ? "" : row.completedTime })} className="rounded border px-2 py-2"><option value="in_progress">Đang xử lý</option><option value="done">Hoàn thành</option></select></td><td className="p-2"><textarea value={row.notes} onChange={(event) => update(index, { notes: event.target.value })} className="min-h-16 w-full rounded border px-2 py-2" maxLength={10000} /></td><td className="p-2"><button type="button" onClick={() => removeRow(index)} className="rounded border border-red-200 px-2 py-2 text-xs font-semibold text-red-700">Xóa</button></td></tr>)}</tbody></table></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50 p-4">{mode === "batch" ? <button type="button" onClick={addRow} disabled={rows.length >= 50} className="rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm font-bold text-orange-800 disabled:opacity-50">+ Thêm dòng</button> : <span className="text-xs text-slate-500">Thời gian dùng định dạng 24 giờ (HH:mm).</span>}<button type="button" onClick={() => void submit()} disabled={busy} className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50">{busy ? "Đang lưu…" : mode === "batch" ? `Lưu ${rows.length} việc` : "Lưu báo cáo"}</button></div>
      </section>
      {error ? <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p> : null}
    </div>
  </main>;
}
