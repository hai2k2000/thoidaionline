"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DepartmentPlanItemRow, DepartmentPlanRow } from "@/lib/departmentPlanRepository";
import type { DepartmentPlanPeriod } from "@/lib/departmentPlanPeriod";
import DepartmentPlanItemDialog from "@/components/DepartmentPlanItemDialog";

type Employee = { id: string; full_name: string; department_id: string };
type Draft = {
  key: string;
  id?: string;
  title: string;
  assigneeId: string;
  assignmentState: DepartmentPlanItemRow["assignment_state"];
  dueAt: string;
  workStatus: DepartmentPlanItemRow["work_status"];
  dirty: boolean;
  saving: boolean;
  error: string;
};

type Props = {
  departmentId: string;
  period: DepartmentPlanPeriod;
  employees: Employee[];
  initialPlan: DepartmentPlanRow | null;
  initialItems: DepartmentPlanItemRow[];
};

const statusLabels: Record<Draft["workStatus"], string> = {
  planned: "Chưa bắt đầu",
  in_progress: "Đang thực hiện",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

const assignmentLabels: Record<Draft["assignmentState"], string> = {
  unassigned: "Chưa phân công",
  department_wide: "Việc chung của phòng",
  assigned: "Có người thực hiện",
};

const toInputDate = (value: string | null) => value ? value.slice(0, 16) : "";
const newDraft = (): Draft => ({ key: `new-${Date.now()}-${Math.random()}`, title: "", assigneeId: "", assignmentState: "unassigned", dueAt: "", workStatus: "planned", dirty: true, saving: false, error: "" });
const fromItem = (item: DepartmentPlanItemRow): Draft => ({ key: item.id, id: item.id, title: item.title, assigneeId: item.assignee_id ?? "", assignmentState: item.assignment_state, dueAt: toInputDate(item.due_at), workStatus: item.work_status, dirty: false, saving: false, error: "" });

const outsidePeriod = (value: string, period: DepartmentPlanPeriod) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const start = new Date(`${period.periodStart}T00:00:00`);
  const end = new Date(`${period.periodEnd}T23:59:59`);
  return date < start || date > end;
};

export default function DepartmentPlanGrid({ departmentId, period, employees, initialPlan, initialItems }: Props) {
  const [plan, setPlan] = useState(initialPlan);
  const [rows, setRows] = useState(() => initialItems.map(fromItem));
  const [message, setMessage] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const savingKeys = useRef(new Set<string>());
  const hasDrafts = useMemo(() => rows.some((row) => row.dirty), [rows]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasDrafts) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasDrafts]);

  useEffect(() => {
    const guardPeriodNavigation = (event: MouseEvent) => {
      if (!hasDrafts) return;
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      const href = target?.getAttribute("href") ?? "";
      if (!href.startsWith("/planning/department?")) return;
      if (!window.confirm("Bạn có nội dung chưa lưu. Rời kỳ này sẽ hủy các dòng chưa lưu, tiếp tục?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", guardPeriodNavigation, true);
    return () => document.removeEventListener("click", guardPeriodNavigation, true);
  }, [hasDrafts]);

  const update = (key: string, patch: Partial<Draft>) => setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch, dirty: true, error: "" } : row));

  const save = async (key: string) => {
    const row = rows.find((candidate) => candidate.key === key);
    if (!row || row.saving || savingKeys.current.has(key)) return;
    if (!row.title.trim()) { update(key, { error: "Vui lòng nhập nội dung công việc." }); return; }
    if (row.dueAt && Number.isNaN(Date.parse(row.dueAt))) { update(key, { error: "Hạn hoàn thành không hợp lệ." }); return; }
    if (row.assignmentState === "assigned" && !row.assigneeId) { update(key, { error: "Vui lòng chọn người thực hiện." }); return; }
    savingKeys.current.add(key);
    setRows((current) => current.map((candidate) => candidate.key === key ? { ...candidate, saving: true, error: "" } : candidate));
    try {
      let currentPlan = plan;
      if (!currentPlan) {
        const planResponse = await fetch("/api/planning/department", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ departmentId, periodType: period.periodType, periodStart: period.periodStart }) });
        if (!planResponse.ok) throw new Error("Không thể mở kỳ kế hoạch.");
        const planPayload = await planResponse.json() as { plan: DepartmentPlanRow };
        currentPlan = planPayload.plan;
        setPlan(currentPlan);
      }
      const body = { title: row.title.trim(), assignee_id: row.assignmentState === "assigned" ? row.assigneeId : null, assignment_state: row.assignmentState, due_at: row.dueAt ? new Date(row.dueAt).toISOString() : null, work_status: row.workStatus };
      const response = row.id
        ? await fetch(`/api/planning/department/items/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch(`/api/planning/department/${currentPlan.id}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(response.status === 403 ? "Bạn không có quyền lưu mục này." : "Không thể lưu mục kế hoạch.");
      const payload = await response.json() as { item: DepartmentPlanItemRow };
      setRows((current) => current.map((candidate) => candidate.key === key ? { ...fromItem(payload.item), dirty: false, saving: false } : candidate));
      setMessage("Đã lưu mục kế hoạch.");
    } catch (error) {
      setRows((current) => current.map((candidate) => candidate.key === key ? { ...candidate, saving: false, error: error instanceof Error ? error.message : "Không thể lưu mục kế hoạch." } : candidate));
    } finally {
      savingKeys.current.delete(key);
    }
  };

  const remove = async (row: Draft) => {
    if (!row.id) { setRows((current) => current.filter((candidate) => candidate.key !== row.key)); return; }
    if (!window.confirm("Xóa mục kế hoạch này?")) return;
    const response = await fetch(`/api/planning/department/items/${row.id}`, { method: "DELETE" });
    if (!response.ok) { update(row.key, { error: "Không thể xóa mục kế hoạch." }); return; }
    setRows((current) => current.filter((candidate) => candidate.key !== row.key));
    setMessage("Đã xóa mục kế hoạch.");
  };

  return (
    <section className="mt-3 rounded-2xl border bg-white p-3 shadow-sm sm:p-4" aria-label="Danh sách kế hoạch phòng">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div><h2 className="text-base font-extrabold">Nội dung kế hoạch</h2><p className="text-xs text-slate-500">Nhập nhanh từng dòng; thông tin chi tiết sẽ bổ sung ở bước sau.</p></div>
        <button type="button" onClick={() => { setRows((current) => [...current, newDraft()]); setMessage(""); }} className="min-h-10 rounded-xl bg-orange-600 px-3.5 py-2 text-sm font-bold text-white shadow-sm hover:bg-orange-700">+ Thêm dòng</button>
      </div>
      {message ? <p role="status" className="mt-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[760px] w-full text-sm">
          <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500"><th className="w-12 p-2">STT</th><th className="min-w-64 p-2">Nội dung công việc</th><th className="min-w-56 p-2">Người thực hiện</th><th className="min-w-48 p-2">Hạn hoàn thành</th><th className="min-w-40 p-2">Trạng thái</th><th className="w-36 p-2">Thao tác</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={row.key} className="border-b align-top last:border-0">
            <td className="p-2 pt-4 font-bold text-slate-500">{index + 1}</td>
            <td className="p-2"><input autoFocus={!row.id && index === rows.length - 1} value={row.title} onChange={(event) => update(row.key, { title: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void save(row.key); } }} placeholder="Nhập nội dung công việc" className="min-h-10 w-full rounded-lg border px-3 py-2" />{row.error ? <p className="mt-1 text-xs font-semibold text-red-700" role="alert">{row.error}</p> : null}</td>
            <td className="space-y-2 p-2"><select value={row.assignmentState} onChange={(event) => { const assignmentState = event.target.value as Draft["assignmentState"]; update(row.key, { assignmentState, assigneeId: assignmentState === "assigned" ? row.assigneeId : "" }); }} className="min-h-10 w-full rounded-lg border px-2 py-2"><option value="unassigned">{assignmentLabels.unassigned}</option><option value="department_wide">{assignmentLabels.department_wide}</option><option value="assigned">{assignmentLabels.assigned}</option></select>{row.assignmentState === "assigned" ? <select value={row.assigneeId} onChange={(event) => update(row.key, { assigneeId: event.target.value })} className="min-h-10 w-full rounded-lg border px-2 py-2"><option value="">Chọn người</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select> : null}</td>
            <td className="p-2"><input type="datetime-local" value={row.dueAt} onChange={(event) => update(row.key, { dueAt: event.target.value })} className="min-h-10 w-full rounded-lg border px-2 py-2" />{outsidePeriod(row.dueAt, period) ? <p className="mt-1 text-xs text-amber-700">Hạn hoàn thành nằm ngoài kỳ kế hoạch.</p> : null}</td>
            <td className="p-2"><select value={row.workStatus} onChange={(event) => update(row.key, { workStatus: event.target.value as Draft["workStatus"] })} className="min-h-10 w-full rounded-lg border px-2 py-2">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
            <td className="space-y-2 p-2"><button type="button" disabled={row.saving} onClick={() => void save(row.key)} className="min-h-10 w-full rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{row.saving ? "Đang lưu…" : "Lưu dòng"}</button>{row.id ? <button type="button" disabled={row.saving} onClick={() => setDetailId(row.id!)} className="min-h-10 w-full rounded-lg border border-orange-200 px-3 py-2 text-xs font-bold text-orange-800 disabled:opacity-50">Chi tiết</button> : null}<button type="button" disabled={row.saving} onClick={() => void remove(row)} className="min-h-10 w-full rounded-lg border px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Xóa</button></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!rows.length ? <p className="py-8 text-center text-sm text-slate-600">Chưa có kế hoạch cho kỳ này. Bấm “+ Thêm dòng” để bắt đầu.</p> : null}
      {detailId ? <DepartmentPlanItemDialog itemId={detailId} period={period} employees={employees} onClose={() => setDetailId(null)} onSaved={(item) => { setRows((current) => current.map((row) => row.id === item.id ? fromItem(item) : row)); setMessage("Đã lưu chi tiết công việc."); }} /> : null}
    </section>
  );
}
