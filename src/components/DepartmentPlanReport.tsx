"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  DepartmentPlanReportMetrics,
} from "@/lib/departmentPlanReport";

type Employee = { id: string; full_name: string; department_id: string };

type ReportData = {
  period: DepartmentPlanPeriod;
  plan: DepartmentPlanRow | null;
  employees: Employee[];
  filters: DepartmentPlanReportFilters;
  metrics: DepartmentPlanReportMetrics;
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
  planned: "Kế hoạch / Chưa bắt đầu",
  in_progress: "Đang thực hiện",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

const assignmentLabels: Record<DepartmentPlanItemRow["assignment_state"], string> = {
  unassigned: "Chưa phân công",
  department_wide: "Cả phòng",
  assigned: "Đã phân công",
};

const metricCards: Array<{ key: keyof DepartmentPlanReportMetrics; label: string; tone: string }> = [
  { key: "total", label: "Tổng công việc", tone: "border-slate-200 bg-slate-50 text-slate-900" },
  { key: "completed", label: "Hoàn thành", tone: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  { key: "inProgress", label: "Đang thực hiện", tone: "border-blue-200 bg-blue-50 text-blue-900" },
  { key: "planned", label: "Kế hoạch", tone: "border-amber-200 bg-amber-50 text-amber-900" },
  { key: "overdue", label: "Quá hạn", tone: "border-rose-200 bg-rose-50 text-rose-900" },
  { key: "unassigned", label: "Chưa phân công", tone: "border-orange-200 bg-orange-50 text-orange-900" },
  { key: "departmentWide", label: "Cả phòng", tone: "border-violet-200 bg-violet-50 text-violet-900" },
];

const toFilters = (filters: DepartmentPlanReportFilters): DepartmentPlanReportFilters => ({
  employeeId: filters.employeeId ?? null,
  workStatus: filters.workStatus ?? null,
  assignmentState: filters.assignmentState ?? null,
});

export default function DepartmentPlanReport({
  userLabel,
  departmentName,
  departmentId,
  period,
  currentWeeklyPeriod,
  currentMonthlyPeriod,
  initialReport,
}: Props) {
  const [report, setReport] = useState(initialReport);
  const [filters, setFilters] = useState(toFilters(initialReport.filters));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const previous = shiftDepartmentPlanStart(period.periodType, period.periodStart, -1);
  const next = shiftDepartmentPlanStart(period.periodType, period.periodStart, 1);
  const thisPeriod = period.periodType === "weekly" ? currentWeeklyPeriod.periodStart : currentMonthlyPeriod.periodStart;
  const periodLabel = formatDepartmentPlanPeriod(period.periodType, period.periodStart, period.periodEnd);
  const weeklyStart = period.periodType === "weekly" ? period.periodStart : currentWeeklyPeriod.periodStart;
  const monthlyStart = period.periodType === "monthly" ? period.periodStart : currentMonthlyPeriod.periodStart;

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      period: period.periodType,
      start: period.periodStart,
      departmentId,
    });
    if (filters.employeeId) query.set("employeeId", filters.employeeId);
    if (filters.workStatus) query.set("status", filters.workStatus);
    if (filters.assignmentState) query.set("assignmentState", filters.assignmentState);
    fetch(`/api/planning/department/reports?${query.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Không thể tải báo cáo kỳ này.");
        return response.json() as Promise<ReportData>;
      })
      .then((payload) => { setError(""); setReport(payload); })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Không thể tải báo cáo kỳ này.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [departmentId, filters.assignmentState, filters.employeeId, filters.workStatus, period.periodStart, period.periodType]);

  const visibleItems = useMemo(() => report.items, [report.items]);

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 lg:flex-row">
        <AppNav currentPath="/planning/reports" userLabel={userLabel} />
        <main className="min-w-0 flex-1">
          <header className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/70 to-sky-100/70 p-5 shadow-sm sm:p-7">
            <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-indigo-200/40 blur-2xl" />
            <p className="relative text-xs font-extrabold uppercase tracking-[0.18em] text-indigo-700">Báo cáo kế hoạch phòng</p>
            <div className="relative mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">BÁO CÁO KẾ HOẠCH</h1>
                <p className="mt-1 text-sm font-semibold text-slate-600">{departmentName} · {periodLabel}</p>
              </div>
              <Link className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-indigo-900 ring-1 ring-indigo-200 hover:bg-indigo-50" href={departmentPlanUrl(period.periodType, period.periodStart, departmentId)}>
                Mở kế hoạch
              </Link>
            </div>
          </header>

          <section className="mt-4 rounded-2xl border bg-white p-3 shadow-sm sm:p-4" aria-label="Chọn loại kỳ báo cáo">
            <div className="flex flex-wrap gap-2">
              <Link className={`rounded-xl px-4 py-2.5 text-sm font-bold ${period.periodType === "weekly" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-indigo-50"}`} href={departmentPlanReportUrl("weekly", weeklyStart, departmentId)}>Báo cáo tuần</Link>
              <Link className={`rounded-xl px-4 py-2.5 text-sm font-bold ${period.periodType === "monthly" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-indigo-50"}`} href={departmentPlanReportUrl("monthly", monthlyStart, departmentId)}>Báo cáo tháng</Link>
            </div>
          </section>

          <section className="mt-3 rounded-2xl border bg-white p-4 shadow-sm sm:p-5" aria-label="Điều hướng kỳ báo cáo">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link className="min-h-11 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2.5 text-sm font-bold text-indigo-900 hover:bg-indigo-100" href={departmentPlanReportUrl(period.periodType, previous, departmentId)}>
                {period.periodType === "weekly" ? "‹ Tuần trước" : "‹ Tháng trước"}
              </Link>
              <p className="text-center text-base font-extrabold text-slate-900 sm:text-lg">{periodLabel}</p>
              <Link className="min-h-11 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2.5 text-sm font-bold text-indigo-900 hover:bg-indigo-100" href={departmentPlanReportUrl(period.periodType, next, departmentId)}>
                {period.periodType === "weekly" ? "Tuần sau ›" : "Tháng sau ›"}
              </Link>
            </div>
            <div className="mt-3 flex justify-center">
              <Link className="min-h-10 rounded-full border px-4 py-2 text-sm font-bold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800" href={departmentPlanReportUrl(period.periodType, thisPeriod, departmentId)}>
                {period.periodType === "weekly" ? "Tuần này" : "Tháng này"}
              </Link>
            </div>
          </section>

          <section className="mt-3 rounded-2xl border bg-white p-4 shadow-sm sm:p-5" aria-label="Bộ lọc báo cáo">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm font-bold text-slate-700">Nhân viên
                <select value={filters.employeeId ?? ""} onChange={(event) => setFilters((current) => ({ ...current, employeeId: event.target.value || null }))} className="mt-1 min-h-11 w-full rounded-xl border px-3 py-2 font-normal">
                  <option value="">Tất cả nhân viên</option>
                  {report.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-slate-700">Trạng thái
                <select value={filters.workStatus ?? ""} onChange={(event) => setFilters((current) => ({ ...current, workStatus: (event.target.value || null) as DepartmentPlanReportFilters["workStatus"] }))} className="mt-1 min-h-11 w-full rounded-xl border px-3 py-2 font-normal">
                  <option value="">Tất cả trạng thái</option>
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-slate-700">Phân công
                <select value={filters.assignmentState ?? ""} onChange={(event) => setFilters((current) => ({ ...current, assignmentState: (event.target.value || null) as DepartmentPlanReportFilters["assignmentState"] }))} className="mt-1 min-h-11 w-full rounded-xl border px-3 py-2 font-normal">
                  <option value="">Tất cả trạng thái phân công</option>
                  {Object.entries(assignmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
            {loading ? <p className="mt-3 text-sm font-semibold text-indigo-700" role="status">Đang tải báo cáo…</p> : null}
            {error ? <p className="mt-3 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
          </section>

          <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Chỉ số báo cáo">
            {metricCards.map((card) => <article key={card.key} className={`rounded-2xl border p-4 shadow-sm ${card.tone}`}><p className="text-xs font-extrabold uppercase tracking-wide opacity-75">{card.label}</p><p className="mt-2 text-3xl font-black">{report.metrics[card.key]}</p></article>)}
          </section>

          <section className="mt-3 rounded-2xl border bg-white p-3 shadow-sm sm:p-4" aria-label="Danh sách kết quả báo cáo">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div><h2 className="text-base font-extrabold">Chi tiết đầu việc</h2><p className="text-xs text-slate-500">Dữ liệu lấy theo kỳ và bộ lọc hiện tại; báo cáo chỉ đọc.</p></div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{report.metrics.total} đầu việc</span>
            </div>
            {visibleItems.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-[720px] w-full text-sm">
                  <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500"><th className="p-2">Đầu việc</th><th className="p-2">Người thực hiện</th><th className="p-2">Hạn hoàn thành</th><th className="p-2">Trạng thái</th><th className="p-2">Phân công</th></tr></thead>
                  <tbody>{visibleItems.map((item) => <tr key={item.id} className="border-b align-top last:border-0"><td className="max-w-[28rem] p-2 font-semibold">{item.title}</td><td className="p-2">{item.assignee_name ?? "—"}</td><td className="whitespace-nowrap p-2">{item.due_at ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(new Date(item.due_at)) : "—"}</td><td className="p-2">{statusLabels[item.work_status]}</td><td className="p-2">{assignmentLabels[item.assignment_state]}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="py-10 text-center text-sm font-semibold text-slate-600">{report.plan ? "Không có đầu việc phù hợp bộ lọc." : "Chưa có kế hoạch cho kỳ này."}</p>}
          </section>
        </main>
      </div>
    </div>
  );
}
