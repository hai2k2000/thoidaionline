"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppNav from "@/components/AppNav";
import type { DepartmentPlanPeriod } from "@/lib/departmentPlanPeriod";
import {
  departmentPlanReportUrl,
  departmentPlanUrl,
  formatDepartmentPlanPeriod,
  shiftDepartmentPlanStart,
} from "@/lib/departmentPlanNavigation";
import type { DepartmentPlanItemRow, DepartmentPlanRow } from "@/lib/departmentPlanRepository";
import type {
  DepartmentPlanReportFilters,
  DepartmentPlanReportItem,
} from "@/lib/departmentPlanReport";
import {
  departmentPlanNextActionText,
  departmentPlanRelationLabel,
  departmentPlanResultText,
  departmentPlanWorkSourceLabel,
  summarizeDepartmentPlanPeriod,
} from "@/lib/departmentPlanPeriodSummary";

type Employee = { id: string; full_name: string; department_id: string };
type ReportData = {
  period: DepartmentPlanPeriod;
  plan: DepartmentPlanRow | null;
  employees: Employee[];
  filters: DepartmentPlanReportFilters;
  metrics: { total: number; completed: number; inProgress: number; planned: number; overdue: number; unassigned: number; departmentWide: number };
  items: DepartmentPlanReportItem[];
};
type Props = {
  userLabel: string;
  departmentName: string;
  departmentId: string;
  period: DepartmentPlanPeriod;
  currentWeeklyPeriod: DepartmentPlanPeriod;
  currentMonthlyPeriod: DepartmentPlanPeriod;
  initialReport: ReportData;
};

const statusLabels: Record<DepartmentPlanItemRow["work_status"], string> = {
  planned: "Chưa bắt đầu",
  in_progress: "Đang thực hiện",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};
const assignmentLabels: Record<DepartmentPlanItemRow["assignment_state"], string> = {
  unassigned: "Chưa phân công",
  department_wide: "Cả phòng",
  assigned: "Đã phân công",
};
const formatDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(new Date(value)) : "—";

function SummaryCard({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return <article className={`rounded-2xl border p-4 shadow-sm ${tone}`}><p className="text-xs font-extrabold uppercase tracking-wide opacity-75">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></article>;
}

function PlanTable({ items }: { items: DepartmentPlanReportItem[] }) {
  return items.length ? <div className="mt-3 overflow-x-auto"><table className="min-w-[980px] w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500"><th className="p-2">Công việc</th><th className="p-2">Người thực hiện</th><th className="p-2">Mục tiêu kỳ</th><th className="p-2">Kết quả kỳ</th><th className="p-2">Trạng thái cuối kỳ</th><th className="p-2">Hạn/mốc</th><th className="p-2">Xử lý kỳ sau</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b align-top last:border-0"><td className="max-w-[18rem] p-2 font-semibold">{item.title}<div className="mt-1 text-xs font-normal text-slate-500">{departmentPlanRelationLabel(item)}</div></td><td className="p-2">{item.assignee_name ?? "—"}</td><td className="max-w-[18rem] p-2">{item.period_goal ?? item.requirements ?? item.description ?? "—"}</td><td className="max-w-[18rem] p-2">{departmentPlanResultText(item)}</td><td className="p-2">{item.period_end_state ?? statusLabels[item.work_status]}</td><td className="whitespace-nowrap p-2">{formatDate(item.period_milestone_at ?? item.due_at)}</td><td className="p-2">{departmentPlanNextActionText(item)}</td></tr>)}</tbody></table></div> : <p className="py-8 text-center text-sm font-semibold text-slate-600">Không có công việc phù hợp.</p>;
}

function SpontaneousTable({ items }: { items: DepartmentPlanReportItem[] }) {
  return items.length ? <div className="mt-3 overflow-x-auto"><table className="min-w-[760px] w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500"><th className="p-2">Công việc</th><th className="p-2">Nguồn</th><th className="p-2">Người thực hiện</th><th className="p-2">Kết quả</th><th className="p-2">Trạng thái</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b align-top last:border-0"><td className="p-2 font-semibold">{item.title}</td><td className="p-2">{departmentPlanWorkSourceLabel(item)}</td><td className="p-2">{item.assignee_name ?? "—"}</td><td className="p-2">{departmentPlanResultText(item)}</td><td className="p-2">{statusLabels[item.work_status]}</td></tr>)}</tbody></table></div> : <p className="py-8 text-center text-sm font-semibold text-slate-600">Không có công việc phát sinh trong kỳ.</p>;
}

function OutstandingTable({ items }: { items: DepartmentPlanReportItem[] }) {
  return items.length ? <div className="mt-3 overflow-x-auto"><table className="min-w-[800px] w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500"><th className="p-2">Công việc</th><th className="p-2">Tồn đọng / nguyên nhân</th><th className="p-2">Tình trạng cuối kỳ</th><th className="p-2">Hướng xử lý</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b align-top last:border-0"><td className="p-2 font-semibold">{item.title}</td><td className="p-2">{item.carry_over_reason ?? "—"}</td><td className="p-2">{item.period_end_state ?? statusLabels[item.work_status]}</td><td className="p-2">{departmentPlanNextActionText(item)}</td></tr>)}</tbody></table></div> : <p className="py-8 text-center text-sm font-semibold text-slate-600">Không có tồn đọng cần xử lý.</p>;
}

export default function DepartmentPlanReport({ userLabel, departmentName, departmentId, period, currentWeeklyPeriod, currentMonthlyPeriod, initialReport }: Props) {
  const [report, setReport] = useState(initialReport);
  const [filters, setFilters] = useState<DepartmentPlanReportFilters>(initialReport.filters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [closing, setClosing] = useState(false);
  const summary = useMemo(() => summarizeDepartmentPlanPeriod(report.items), [report.items]);
  const previous = shiftDepartmentPlanStart(period.periodType, period.periodStart, -1);
  const next = shiftDepartmentPlanStart(period.periodType, period.periodStart, 1);
  const thisPeriod = period.periodType === "weekly" ? currentWeeklyPeriod.periodStart : currentMonthlyPeriod.periodStart;
  const periodLabel = formatDepartmentPlanPeriod(period.periodType, period.periodStart, period.periodEnd);
  const weeklyStart = period.periodType === "weekly" ? period.periodStart : currentWeeklyPeriod.periodStart;
  const monthlyStart = period.periodType === "monthly" ? period.periodStart : currentMonthlyPeriod.periodStart;

  const queryFor = useCallback(() => {
    const query = new URLSearchParams({ period: period.periodType, start: period.periodStart, departmentId });
    if (filters.employeeId) query.set("employeeId", filters.employeeId);
    if (filters.workStatus) query.set("status", filters.workStatus);
    if (filters.assignmentState) query.set("assignmentState", filters.assignmentState);
    return query;
  }, [departmentId, filters.assignmentState, filters.employeeId, filters.workStatus, period.periodStart, period.periodType]);
  const exportDocx = async () => {
    if (exporting) return;
    setExporting(true); setError("");
    try {
      const response = await fetch(`/api/planning/department/reports/docx?${queryFor().toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Không thể xuất báo cáo Word.");
      const blob = await response.blob();
      const filename = response.headers.get("Content-Disposition")?.match(/filename="([^\"]+)"/)?.[1] ?? `Bao_cao_cong_tac_${period.periodStart}.docx`;
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể xuất báo cáo Word."); } finally { setExporting(false); }
  };
  const closePeriod = async () => {
    if (!report.plan || closing || report.plan.status === "closed" || !window.confirm("Chốt kỳ này và lưu snapshot kết quả?")) return;
    setClosing(true); setError("");
    try {
      const allItemsQuery = new URLSearchParams({ period: period.periodType, start: period.periodStart, departmentId });
      const allItemsResponse = await fetch(`/api/planning/department/reports?${allItemsQuery.toString()}`, { cache: "no-store" });
      if (!allItemsResponse.ok) throw new Error("Không thể tải đầy đủ dữ liệu để chốt kỳ.");
      const allItemsReport = await allItemsResponse.json() as ReportData;
      const response = await fetch(`/api/planning/department/${report.plan.id}/close`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decisions: allItemsReport.items.map((item) => ({ itemId: item.id, carryForward: item.work_status !== "completed" && item.work_status !== "cancelled" })) }) });
      if (!response.ok) throw new Error(response.status === 403 ? "Bạn không có quyền chốt kỳ này." : "Không thể chốt kỳ kế hoạch.");
      setReport((current) => ({ ...current, plan: current.plan ? { ...current.plan, status: "closed" } : current.plan }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể chốt kỳ kế hoạch."); } finally { setClosing(false); }
  };

  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    fetch(`/api/planning/department/reports?${queryFor().toString()}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("Không thể tải tổng kết kỳ."); return response.json() as Promise<ReportData>; })
      .then((payload) => { setError(""); setReport(payload); })
      .catch((reason: unknown) => { if (reason instanceof DOMException && reason.name === "AbortError") return; setError(reason instanceof Error ? reason.message : "Không thể tải tổng kết kỳ."); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [queryFor]);

  return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6"><div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 lg:flex-row"><AppNav currentPath="/planning/reports" userLabel={userLabel} /><main className="min-w-0 flex-1">
    <header className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/70 to-sky-100/70 p-5 shadow-sm sm:p-7"><div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-indigo-200/40 blur-2xl" /><p className="relative text-xs font-extrabold uppercase tracking-[0.18em] text-indigo-700">Tổng kết kế hoạch phòng</p><div className="relative mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">TỔNG KẾT KỲ</h1><p className="mt-1 text-sm font-semibold text-slate-600">{departmentName} · {periodLabel}</p></div><div className="flex flex-wrap gap-2"><Link className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-indigo-900 ring-1 ring-indigo-200 hover:bg-indigo-50" href={departmentPlanUrl(period.periodType, period.periodStart, departmentId)}>← Quay lại kế hoạch kỳ</Link>{report.plan?.status !== "closed" && report.plan ? <button type="button" onClick={() => void closePeriod()} disabled={closing} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 disabled:opacity-60">{closing ? "Đang chốt…" : "Chốt kỳ"}</button> : null}<button type="button" onClick={() => void exportDocx()} disabled={exporting} className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60">{exporting ? "Đang xuất Word…" : "Xuất báo cáo Word"}</button></div></div></header>
    <section className="mt-4 rounded-2xl border bg-white p-3 shadow-sm sm:p-4" aria-label="Chọn loại kỳ tổng kết"><div className="flex flex-wrap gap-2"><Link className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-indigo-50" href={departmentPlanUrl("weekly", weeklyStart, departmentId)}>Kế hoạch tuần</Link><Link className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-indigo-50" href={departmentPlanUrl("monthly", monthlyStart, departmentId)}>Kế hoạch tháng</Link><span className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm">Tổng kết kỳ</span></div></section>
    <section className="mt-3 rounded-2xl border bg-white p-4 shadow-sm sm:p-5" aria-label="Điều hướng kỳ tổng kết"><div className="flex flex-wrap items-center justify-between gap-3"><Link className="min-h-11 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2.5 text-sm font-bold text-indigo-900 hover:bg-indigo-100" href={departmentPlanReportUrl(period.periodType, previous, departmentId)}>{period.periodType === "weekly" ? "‹ Tuần trước" : "‹ Tháng trước"}</Link><p className="text-center text-base font-extrabold text-slate-900 sm:text-lg">{periodLabel}</p><Link className="min-h-11 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2.5 text-sm font-bold text-indigo-900 hover:bg-indigo-100" href={departmentPlanReportUrl(period.periodType, next, departmentId)}>{period.periodType === "weekly" ? "Tuần sau ›" : "Tháng sau ›"}</Link></div><div className="mt-3 flex justify-center"><Link className="min-h-10 rounded-full border px-4 py-2 text-sm font-bold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800" href={departmentPlanReportUrl(period.periodType, thisPeriod, departmentId)}>{period.periodType === "weekly" ? "Tuần này" : "Tháng này"}</Link></div></section>
    <section className="mt-3 rounded-2xl border bg-white p-4 shadow-sm sm:p-5" aria-label="Lọc chi tiết tổng kết"><div className="grid gap-3 md:grid-cols-3"><label className="text-sm font-bold text-slate-700">Trạng thái<select value={filters.workStatus ?? ""} onChange={(event) => setFilters((current) => ({ ...current, workStatus: (event.target.value || null) as DepartmentPlanReportFilters["workStatus"] }))} className="mt-1 min-h-11 w-full rounded-xl border px-3 py-2 font-normal"><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-bold text-slate-700">Phân công<select value={filters.assignmentState ?? ""} onChange={(event) => setFilters((current) => ({ ...current, assignmentState: (event.target.value || null) as DepartmentPlanReportFilters["assignmentState"] }))} className="mt-1 min-h-11 w-full rounded-xl border px-3 py-2 font-normal"><option value="">Tất cả trạng thái phân công</option>{Object.entries(assignmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-bold text-slate-700">Lọc nhân viên (tùy chọn)<select value={filters.employeeId ?? ""} onChange={(event) => setFilters((current) => ({ ...current, employeeId: event.target.value || null }))} className="mt-1 min-h-11 w-full rounded-xl border px-3 py-2 font-normal"><option value="">Tất cả nhân viên</option>{report.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select></label></div>{loading ? <p className="mt-3 text-sm font-semibold text-indigo-700" role="status">Đang tải tổng kết…</p> : null}{error ? <p className="mt-3 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}</section>
    <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Chỉ số tổng kết kỳ"><SummaryCard label="Kế hoạch đầu kỳ" value={summary.plannedItems.length} tone="border-slate-200 bg-slate-50 text-slate-900" /><SummaryCard label="Hoàn thành" value={summary.completedItems.length} tone="border-emerald-200 bg-emerald-50 text-emerald-900" /><SummaryCard label="Chưa hoàn thành" value={summary.unfinishedItems.length} tone="border-amber-200 bg-amber-50 text-amber-900" /><SummaryCard label="Dài hạn tiếp tục" value={summary.longRunningItems.length} tone="border-blue-200 bg-blue-50 text-blue-900" /><SummaryCard label="Chuyển tiếp kỳ sau" value={summary.carryOverItems.length} tone="border-orange-200 bg-orange-50 text-orange-900" /><SummaryCard label="Định kỳ" value={summary.recurringItems.length} tone="border-violet-200 bg-violet-50 text-violet-900" /><SummaryCard label="Phát sinh ngoài kế hoạch" value={summary.spontaneousItems.length} tone="border-rose-200 bg-rose-50 text-rose-900" /><SummaryCard label="Tỷ lệ hoàn thành kế hoạch" value={`${summary.completionRate}%`} tone="border-cyan-200 bg-cyan-50 text-cyan-900" /></section>
    <section className="mt-3 rounded-2xl border bg-white p-3 shadow-sm sm:p-4" aria-label="Công việc trong kế hoạch"><div className="border-b pb-3"><h2 className="text-base font-extrabold">I. CÔNG VIỆC TRONG KẾ HOẠCH</h2><p className="text-xs text-slate-500">Mẫu số: hoàn thành kế hoạch = công việc trong kế hoạch đã hoàn thành / tổng công việc trong kế hoạch; không tính phát sinh.</p></div><PlanTable items={summary.plannedItems} /></section>
    <section className="mt-3 rounded-2xl border bg-white p-3 shadow-sm sm:p-4" aria-label="Công việc phát sinh trong kỳ"><div className="border-b pb-3"><h2 className="text-base font-extrabold">II. CÔNG VIỆC PHÁT SINH TRONG KỲ</h2><p className="text-xs text-slate-500">Các mục được tự động thêm trong kỳ, tách khỏi mẫu số hoàn thành kế hoạch.</p></div><SpontaneousTable items={summary.spontaneousItems} /></section>
    <section className="mt-3 rounded-2xl border bg-white p-3 shadow-sm sm:p-4" aria-label="Tồn đọng nguyên nhân hướng xử lý"><div className="border-b pb-3"><h2 className="text-base font-extrabold">III. TỒN ĐỌNG / NGUYÊN NHÂN / HƯỚNG XỬ LÝ</h2><p className="text-xs text-slate-500">Chỉ dùng dữ liệu mục tiêu, kết quả, trạng thái và lý do chuyển tiếp đã lưu.</p></div><OutstandingTable items={summary.outstandingItems} /></section>
    <section className="mt-3 rounded-2xl border bg-white p-3 shadow-sm sm:p-4" aria-label="Công việc dài hạn chuyển tiếp"><div className="border-b pb-3"><h2 className="text-base font-extrabold">IV. CÔNG VIỆC DÀI HẠN / CHUYỂN TIẾP</h2></div><PlanTable items={summary.continuationItems} /></section>
    <section className="mt-3 rounded-2xl border bg-white p-3 shadow-sm sm:p-4" aria-label="Kế hoạch kỳ tiếp theo"><div className="border-b pb-3"><h2 className="text-base font-extrabold">V. KẾ HOẠCH KỲ TIẾP THEO</h2><p className="text-xs text-slate-500">Danh sách đề xuất tiếp tục từ công việc dài hạn, chuyển tiếp và định kỳ của kỳ hiện tại.</p></div><PlanTable items={summary.nextPeriodItems} /></section>
  </main></div></div>;
}
