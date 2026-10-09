"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateOnlyVN } from "@/lib/businessDate.mjs";

type Period = "week" | "month" | "range";
type SummaryRow = { id: string; title: string; description: string | null; report_work_date: string | null; start_date: string | null; completion_date: string | null; report_notes: string | null; status: string };
type Payload = { from: string; to: string; report: { rows: SummaryRow[]; total: number; metrics: { total: number; completed: number; inProgress: number; unfinished: number } } };

const dateLabel = (value: string | null) => value ? formatDateOnlyVN(value) : "—";
const statusLabel = (value: string) => ({ done: "Hoàn thành", in_progress: "Đang thực hiện", cancelled: "Đã hủy" }[value] ?? value);

export default function PersonalQuickReportSummary() {
  const [period, setPeriod] = useState<Period>("month");
  const [anchor, setAnchor] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loadedQueryKey, setLoadedQueryKey] = useState("");
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams({ period });
    if (anchor) params.set("from", anchor);
    if (period === "range" && rangeEnd) params.set("to", rangeEnd);
    return params;
  }, [anchor, period, rangeEnd]);
  const queryKey = query.toString();
  const busy = !loadedQueryKey || loadedQueryKey !== queryKey;

  useEffect(() => {
    let active = true;
    fetch(`/api/tasks/quick-report/summary?${queryKey}`, { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => { const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.error?.message ?? "Không thể tải tổng hợp việc phát sinh."); return data as Payload; })
      .then((data) => { if (active) { setPayload(data); setError(""); setLoadedQueryKey(queryKey); } })
      .catch((cause) => { if (active) { setError(cause instanceof Error ? cause.message : "Không thể tải tổng hợp việc phát sinh."); setLoadedQueryKey(queryKey); } });
    return () => { active = false; };
  }, [queryKey]);

  const choosePeriod = (value: Period) => { setPeriod(value); if (value !== "range") { setAnchor(""); setRangeEnd(""); } };
  const exportHref = `/api/tasks/quick-report/summary/docx?${queryKey}`;

  return <section id="personal-quick-report-summary" aria-label="Tổng hợp việc phát sinh" className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">Lịch sử cá nhân</p><h2 className="mt-1 text-2xl font-black">Tổng hợp việc phát sinh</h2><p className="mt-1 text-sm text-slate-600">Chỉ hiển thị các báo cáo do bạn tạo.</p></div><a href={payload && !busy && payload.report.total ? exportHref : undefined} aria-disabled={!payload || busy || payload.report.total === 0} className={`rounded-lg px-4 py-2 text-sm font-bold ${payload && !busy && payload.report.total ? "bg-orange-500 text-white" : "pointer-events-none bg-slate-200 text-slate-500"}`}>Xuất báo cáo Word</a></div>
    <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => choosePeriod("week")} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${period === "week" ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-700"}`}>Tuần</button><button type="button" onClick={() => choosePeriod("month")} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${period === "month" ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-700"}`}>Tháng</button><button type="button" onClick={() => choosePeriod("range")} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${period === "range" ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-700"}`}>Từ ngày → Đến ngày</button></div>
    {period === "range" ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Từ ngày<input type="date" value={anchor} onChange={(event) => setAnchor(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label><label className="text-sm font-semibold">Đến ngày<input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label></div> : null}
    <p className="mt-4 text-sm font-semibold text-slate-600">Khoảng thời gian: {payload && !busy ? `${dateLabel(payload.from)} – ${dateLabel(payload.to)}` : "Đang tải…"}</p>
    {payload && !busy ? <div className="mt-4 grid gap-3 sm:grid-cols-4"><div className="rounded-xl bg-orange-50 p-3"><p className="text-xs font-semibold text-orange-700">Tổng công việc phát sinh</p><p className="mt-1 text-2xl font-black text-orange-900">{payload.report.metrics.total}</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-semibold text-emerald-700">Đã hoàn thành</p><p className="mt-1 text-2xl font-black text-emerald-900">{payload.report.metrics.completed}</p></div><div className="rounded-xl bg-sky-50 p-3"><p className="text-xs font-semibold text-sky-700">Đang thực hiện</p><p className="mt-1 text-2xl font-black text-sky-900">{payload.report.metrics.inProgress}</p></div><div className="rounded-xl bg-slate-100 p-3"><p className="text-xs font-semibold text-slate-600">Chưa hoàn thành</p><p className="mt-1 text-2xl font-black text-slate-900">{payload.report.metrics.unfinished}</p></div></div> : null}
    {busy ? <p className="mt-5 text-sm text-slate-600">Đang tải dữ liệu…</p> : error ? <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p> : payload?.report.total === 0 ? <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-600">Chưa có công việc phát sinh trong khoảng thời gian này.</p> : <div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500"><th className="p-2">Ngày</th><th className="p-2">Tên công việc</th><th className="p-2">Nội dung / yêu cầu</th><th className="p-2">Ngày bắt đầu</th><th className="p-2">Ngày hoàn thành</th><th className="p-2">Trạng thái</th></tr></thead><tbody>{payload?.report.rows.map((row) => <tr key={row.id} className="border-b border-slate-100 align-top"><td className="p-2 whitespace-nowrap">{dateLabel(row.report_work_date)}</td><td className="p-2 font-semibold">{row.title}</td><td className="p-2">{row.description || row.report_notes || "—"}</td><td className="p-2 whitespace-nowrap">{dateLabel(row.start_date)}</td><td className="p-2 whitespace-nowrap">{dateLabel(row.completion_date)}</td><td className="p-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{statusLabel(row.status)}</span></td></tr>)}</tbody></table></div>}
  </section>;
}