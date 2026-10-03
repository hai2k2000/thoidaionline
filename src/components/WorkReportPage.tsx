/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkReportRow } from "@/lib/workReport";

type FilterChange = Record<string, string | number | null | undefined>;
const sourceOptions = [["", "Tất cả"], ["assigned", "Được giao"], ["department_plan", "Kế hoạch phòng"], ["report_only", "Việc phát sinh"]] as const;
const statusOptions = [["", "Tất cả"], ["done", "Hoàn thành"], ["in_progress", "Đang thực hiện"], ["pending_review", "Chờ duyệt"], ["rejected", "Trả lại"], ["new", "Mới"], ["blocked", "Có vướng mắc"], ["waiting", "Đang chờ"]] as const;

export default function WorkReportPage({ initial }: { initial: any }) {
  const router = useRouter();
  const [employeeOpen, setEmployeeOpen] = useState(Boolean(initial.employeeId));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(initial.employeeId ?? null);
  const [employeeReport, setEmployeeReport] = useState<any>(initial.employeeId ? initial.report : null);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const navigate = (changes: FilterChange = {}) => {
    const values = { period: initial.period, from: initial.from, to: initial.to, departmentId: initial.departmentId, employeeId: initial.employeeId, source: initial.source, status: initial.status, page: initial.report.page, pageSize: initial.report.pageSize, ...changes };
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== null && value !== "" && !(key === "page" && Number(value) === 1)) query.set(key, String(value));
    router.push(`/reports/work?${query.toString()}`);
  };
  const page = Number(initial.report.page) || 1;
  const pageSize = Number(initial.report.pageSize) || 20;
  const total = Number(initial.report.total) || 0;
  const shiftPeriod = (delta: number) => { const date = new Date(`${initial.from}T12:00:00+07:00`); if (initial.period === "month") date.setMonth(date.getMonth() + delta); else date.setDate(date.getDate() + delta * 7); navigate({ from: date.toISOString().slice(0, 10), page: 1 }); };
  const openEmployee = async (id: string) => {
    setSelectedEmployeeId(id); setEmployeeOpen(true);
    if (initial.employeeId === id && employeeReport) return;
    setEmployeeLoading(true);
    try {
      const query = new URLSearchParams({ period: initial.period, from: initial.from, to: initial.to, employeeId: id, page: "1", pageSize: "50" });
      if (initial.departmentId) query.set("departmentId", initial.departmentId);
      if (initial.source) query.set("source", initial.source);
      if (initial.status) query.set("status", initial.status);
      const response = await fetch(`/api/reports/work?${query.toString()}`, { credentials: "same-origin" });
      if (!response.ok) throw new Error("Không thể tải báo cáo nhân viên.");
      const payload = await response.json();
      setEmployeeReport(payload.report);
    } catch { setEmployeeReport(null); } finally { setEmployeeLoading(false); }
  };
  const closeEmployee = () => { setEmployeeOpen(false); setSelectedEmployeeId(null); setEmployeeReport(null); };
  const activeReport = employeeReport ?? initial.report;
  const employee = activeReport.employees.find((item: any) => item.id === selectedEmployeeId);
  const returnTo = `/reports/work?${new URLSearchParams(Object.entries({ period: initial.period, from: initial.from, to: initial.to, departmentId: initial.departmentId, employeeId: selectedEmployeeId, source: initial.source, status: initial.status, page: initial.report.page, pageSize: initial.report.pageSize }).filter(([, value]) => value !== undefined && value !== null && value !== "").map(([key, value]) => [key, String(value)]))}`;
  return <main className="min-h-screen bg-[#f4f1ea] p-4 text-slate-900 sm:p-8"><div className="mx-auto max-w-7xl"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-700">Báo cáo công việc của phòng</p><h1 className="text-3xl font-black">Báo cáo công việc</h1><p className="mt-1 text-sm text-slate-600">{initial.from} → {initial.to}</p></div>
    <section className="mt-5 grid gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"><label className="grid gap-1 text-sm font-semibold" htmlFor="work-report-period">Kỳ báo cáo<select id="work-report-period" value={initial.period} onChange={(event) => navigate({ period: event.target.value, from: initial.from, to: event.target.value === "range" ? initial.to : undefined, page: 1 })} className="rounded-lg border px-3 py-2 font-normal"><option value="week">Tuần</option><option value="month">Tháng</option><option value="range">Khoảng thời gian</option></select></label><label className="grid gap-1 text-sm font-semibold" htmlFor="work-report-anchor">Ngày/kỳ bắt đầu<input id="work-report-anchor" type="date" value={initial.from} onChange={(event) => navigate({ from: event.target.value, page: 1 })} className="rounded-lg border px-3 py-2 font-normal" /></label>{initial.period === "range" ? <label className="grid gap-1 text-sm font-semibold" htmlFor="work-report-to">Ngày kết thúc<input id="work-report-to" type="date" value={initial.to} min={initial.from} onChange={(event) => navigate({ to: event.target.value, page: 1 })} className="rounded-lg border px-3 py-2 font-normal" /></label> : <div className="flex items-end gap-2"><button type="button" onClick={() => shiftPeriod(-1)} className="rounded-lg border px-3 py-2 text-sm font-semibold">← Kỳ trước</button><button type="button" onClick={() => shiftPeriod(1)} className="rounded-lg border px-3 py-2 text-sm font-semibold">Kỳ sau →</button></div>}<label className="grid gap-1 text-sm font-semibold" htmlFor="work-report-source">Nguồn công việc<select id="work-report-source" value={initial.source ?? ""} onChange={(event) => navigate({ source: event.target.value, page: 1 })} className="rounded-lg border px-3 py-2 font-normal">{sourceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold" htmlFor="work-report-status">Trạng thái<select id="work-report-status" value={initial.status ?? ""} onChange={(event) => navigate({ status: event.target.value, page: 1 })} className="rounded-lg border px-3 py-2 font-normal">{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></section>
    <section className="mt-5 overflow-x-auto rounded-2xl border bg-white shadow-sm"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Nhân viên</th><th className="p-3">Tổng</th><th className="p-3">Hoàn thành</th><th className="p-3">Đang làm</th><th className="p-3">Việc phát sinh</th></tr></thead><tbody>{initial.report.employees.map((item: any) => <tr key={item.id} className="cursor-pointer border-t hover:bg-orange-50" onClick={() => openEmployee(item.id)}><td className="p-3 font-semibold underline decoration-orange-300 underline-offset-2">{item.full_name}</td><td className="p-3">{item.total}</td><td className="p-3">{item.completed}</td><td className="p-3">{item.active}</td><td className="p-3">{item.reportOnly}</td></tr>)}</tbody></table>{initial.report.employees.length === 0 ? <p className="p-6 text-sm text-slate-500">Không có nhân viên trong phạm vi báo cáo</p> : null}</section>
    {(initial.report.total > 0 && !employeeOpen) ? <p className="mt-5 rounded-2xl border bg-white p-6 text-sm text-slate-600">Chọn một nhân viên để xem chi tiết công việc trong kỳ báo cáo.</p> : null}
  </div>
  {employeeOpen && employeeLoading ? <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><div className="rounded-xl bg-white px-6 py-5 font-semibold">Đang tải báo cáo nhân viên…</div></div> : null}
  {employeeOpen && employee ? <div role="presentation" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onMouseDown={(event) => event.target === event.currentTarget && closeEmployee()}><section role="dialog" aria-modal="true" aria-labelledby="employee-report-title" className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-orange-700">Báo cáo công việc</p><h2 id="employee-report-title" className="text-2xl font-black">{employee.full_name}</h2><p className="text-sm text-slate-600">{employee.department_name ?? "Phòng ban"} · {initial.from} → {initial.to}</p></div><button type="button" aria-label="Đóng" onClick={closeEmployee} className="rounded-lg border px-3 py-2 font-semibold">Đóng</button></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-6">{[["Tổng công việc",employee.total],["Hoàn thành",employee.completed],["Đang thực hiện",employee.active],["Việc phát sinh",employee.reportOnly],["Được giao",employee.assigned ?? 0],["Kế hoạch phòng",employee.departmentPlan ?? 0]].map(([label,value]) => <div key={String(label)} className="rounded-xl border bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>)}</div><div className="mt-5 overflow-x-auto rounded-xl border"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Công việc</th><th className="p-3">Nguồn</th><th className="p-3">Bắt đầu</th><th className="p-3">Hoàn thành / Hạn</th><th className="p-3">Trạng thái</th><th className="p-3">Kết quả</th></tr></thead><tbody>{activeReport.rows.map((row: WorkReportRow) => <tr key={`${row.id}-${row.assigneeId}`} className="cursor-pointer border-t hover:bg-orange-50" onClick={() => router.push(`/tasks/${row.id}?returnTo=${encodeURIComponent(returnTo)}`)}><td className="p-3 font-semibold">{row.title}</td><td className="p-3">{row.sourceLabel}</td><td className="p-3">{row.startDate ?? "—"}</td><td className="p-3">{row.completedAt ?? row.dueDate ?? "—"}</td><td className="p-3">{row.status}</td><td className="p-3">{row.reportNotes ?? "—"}</td></tr>)}</tbody></table>{activeReport.rows.length === 0 ? <p className="p-6 text-sm text-slate-500">Không có công việc trong kỳ đã chọn</p> : null}</div></section></div> : null}
  </main>;
}
