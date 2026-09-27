"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DepartmentPlanItemRow, DepartmentPlanRow } from "@/lib/departmentPlanRepository";
import type { DepartmentPlanPeriod } from "@/lib/departmentPlanPeriod";
import type { AssignmentDepartment, AssignmentPerson, AssignmentScope } from "@/lib/taskAssignmentRepository";
import DepartmentPlanItemDialog from "@/components/DepartmentPlanItemDialog";
import DepartmentPlanAssignmentDialog from "@/components/DepartmentPlanAssignmentDialog";

type Employee = { id: string; full_name: string; department_id: string };
type Draft = {
  key: string;
  id?: string;
  title: string;
  assigneeId: string;
  assignmentState: DepartmentPlanItemRow["assignment_state"];
  dueAt: string;
  workStatus: DepartmentPlanItemRow["work_status"];
  linkedTaskId: string | null;
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
  departmentName: string;
  departmentCode: string | null;
  departmentManagerId: string | null;
  scopeKind: "own_department" | "global";
  assignmentDepartments: AssignmentDepartment[];
  assignmentPeople: AssignmentPerson[];
  assignmentScope: AssignmentScope;
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
const newDraft = (): Draft => ({ key: `new-${Date.now()}-${Math.random()}`, title: "", assigneeId: "", assignmentState: "unassigned", dueAt: "", workStatus: "planned", linkedTaskId: null, dirty: true, saving: false, error: "" });
const fromItem = (item: DepartmentPlanItemRow): Draft => ({ key: item.id, id: item.id, title: item.title, assigneeId: item.assignee_id ?? "", assignmentState: item.assignment_state, dueAt: toInputDate(item.due_at), workStatus: item.work_status, linkedTaskId: item.linked_task_id, dirty: false, saving: false, error: "" });

const outsidePeriod = (value: string, period: DepartmentPlanPeriod) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const start = new Date(`${period.periodStart}T00:00:00`);
  const end = new Date(`${period.periodEnd}T23:59:59`);
  return date < start || date > end;
};

export default function DepartmentPlanGrid({ departmentId, period, employees, initialPlan, initialItems, departmentName, departmentCode, departmentManagerId, scopeKind, assignmentDepartments, assignmentPeople, assignmentScope }: Props) {
  const [plan, setPlan] = useState(initialPlan);
  const [rows, setRows] = useState(() => initialItems.map(fromItem));
  const [message, setMessage] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
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

  const cancelEdits = (row: Draft) => {
    if (!row.id) {
      setRows((current) => current.filter((candidate) => candidate.key !== row.key));
      return;
    }
    const stored = initialItems.find((item) => item.id === row.id);
    if (stored) setRows((current) => current.map((candidate) => candidate.key === row.key ? fromItem(stored) : candidate));
  };

  return (
    <section className="mt-3 rounded-2xl border bg-white p-3 shadow-sm sm:p-4" aria-label="Danh sách kế hoạch phòng">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div><h2 className="text-base font-extrabold">Nội dung kế hoạch</h2><p className="text-xs text-slate-500">Nhập nhanh từng dòng; thông tin chi tiết sẽ bổ sung ở bước sau.</p></div>
        <button type="button" onClick={() => { setRows((current) => [...current, newDraft()]); setMessage(""); }} className="min-h-9 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-bold text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2">+ Thêm dòng</button>
      </div>
      {message ? <p role="status" className="mt-3 text-sm font-semibold text-emerald-700">{message}</p> : null}

      <div className="mt-3 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[980px] table-fixed text-sm">
          <caption className="sr-only">Các mục trong kế hoạch phòng ban</caption>
          <colgroup><col className="w-12" /><col /><col className="w-[25%]" /><col className="w-[17%]" /><col className="w-[13%]" /><col className="w-[158px]" /></colgroup>
          <thead><tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500"><th scope="col" className="px-2 py-2">STT</th><th scope="col" className="px-2 py-2">Nội dung công việc</th><th scope="col" className="px-2 py-2">Người thực hiện</th><th scope="col" className="px-2 py-2">Hạn hoàn thành</th><th scope="col" className="px-2 py-2">Trạng thái</th><th scope="col" className="px-2 py-2 text-right">Thao tác</th></tr></thead>
          <tbody>{rows.map((row, index) => {
            const draft = !row.id;
            const dirty = Boolean(row.id && row.dirty);
            const actionLabel = row.linkedTaskId ? "Mở công việc" : "Giao việc";
            return <tr key={row.key} className={`border-b border-slate-100 align-middle last:border-0 hover:bg-orange-50/40 ${draft ? "bg-slate-50/70" : ""} ${dirty ? "bg-amber-50/50" : ""}`}>
              <td className="px-2 py-2 align-middle font-bold tabular-nums text-slate-400">{index + 1}</td>
              <td className="px-2 py-2 align-middle"><input autoFocus={draft && index === rows.length - 1} value={row.title} onChange={(event) => update(row.key, { title: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void save(row.key); } }} placeholder="Nhập nội dung công việc" aria-label={`Nội dung công việc ${index + 1}`} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />{row.error ? <p className="mt-1 text-xs font-semibold text-red-700" role="alert">{row.error}</p> : null}</td>
              <td className="px-2 py-2 align-middle"><div className="flex items-center gap-1.5"><select value={row.assignmentState} onChange={(event) => { const assignmentState = event.target.value as Draft["assignmentState"]; update(row.key, { assignmentState, assigneeId: assignmentState === "assigned" ? row.assigneeId : "" }); }} aria-label={`Trạng thái phân công ${index + 1}`} className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"><option value="unassigned">{assignmentLabels.unassigned}</option><option value="department_wide">{assignmentLabels.department_wide}</option><option value="assigned">{assignmentLabels.assigned}</option></select>{row.assignmentState === "assigned" ? <select value={row.assigneeId} onChange={(event) => update(row.key, { assigneeId: event.target.value })} aria-label={`Người thực hiện ${index + 1}`} className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"><option value="">Chọn người</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select> : null}</div></td>
              <td className="px-2 py-2 align-middle"><input type="datetime-local" value={row.dueAt} onChange={(event) => update(row.key, { dueAt: event.target.value })} aria-label={`Hạn hoàn thành ${index + 1}`} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />{outsidePeriod(row.dueAt, period) ? <p className="mt-1 text-[11px] text-amber-700">Hạn hoàn thành nằm ngoài kỳ kế hoạch</p> : null}</td>
              <td className="px-2 py-2 align-middle"><select value={row.workStatus} onChange={(event) => update(row.key, { workStatus: event.target.value as Draft["workStatus"] })} aria-label={`Trạng thái công việc ${index + 1}`} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
              <td className="px-2 py-2 align-middle"><div className="flex items-center justify-end gap-1.5">
                {draft ? <><button type="button" disabled={row.saving} onClick={() => void save(row.key)} className="h-8 rounded-lg bg-orange-600 px-2.5 text-xs font-bold text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50">{row.saving ? "Đang lưu…" : "Lưu"}</button><button type="button" disabled={row.saving} onClick={() => cancelEdits(row)} className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50">Hủy</button></> : dirty ? <><button type="button" disabled={row.saving} onClick={() => void save(row.key)} className="h-8 rounded-lg bg-orange-600 px-2.5 text-xs font-bold text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50">{row.saving ? "Đang lưu…" : "Lưu"}</button><button type="button" disabled={row.saving} onClick={() => cancelEdits(row)} className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50">Hủy</button></> : row.linkedTaskId ? <a href={`/tasks/${row.linkedTaskId}`} className="inline-flex h-8 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400">{actionLabel}</a> : <button type="button" disabled={row.saving} onClick={() => setAssignmentId(row.id!)} className="h-8 rounded-lg bg-orange-600 px-2.5 text-xs font-bold text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50">{actionLabel}</button>}
                {!draft ? <details className="relative"><summary className="flex h-8 cursor-pointer list-none items-center rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-700 outline-none hover:bg-slate-50 focus:ring-2 focus:ring-slate-400 [&::-webkit-details-marker]:hidden" aria-label={`Thao tác mục ${index + 1}`}><span aria-hidden="true">⋯</span><span className="sr-only">Thao tác</span></summary><div className="absolute right-0 z-10 mt-1 w-36 rounded-lg border border-slate-200 bg-white p-1.5 text-left shadow-lg"><button type="button" onClick={() => setDetailId(row.id!)} className="block w-full rounded-md px-2.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-orange-50 focus:bg-orange-50 focus:outline-none">Chi tiết</button><button type="button" onClick={() => setDetailId(row.id!)} className="block w-full rounded-md px-2.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-orange-50 focus:bg-orange-50 focus:outline-none">Chỉnh sửa</button><button type="button" disabled={row.saving} onClick={() => void remove(row)} className="block w-full rounded-md px-2.5 py-2 text-left text-xs font-semibold text-red-700 hover:bg-red-50 focus:bg-red-50 focus:outline-none disabled:opacity-50">Xóa</button></div></details> : null}
              </div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>

      <div className="mt-3 space-y-2 md:hidden">{rows.map((row, index) => {
        const draft = !row.id;
        const dirty = Boolean(row.id && row.dirty);
        return <article key={row.key} className={`rounded-xl border p-3 shadow-sm ${draft ? "border-slate-200 bg-slate-50/70" : "border-slate-200 bg-white"} ${dirty ? "border-amber-300 bg-amber-50/40" : ""}`}>
          <div className="flex items-start gap-2"><span className="pt-1 text-xs font-bold tabular-nums text-slate-400">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><input autoFocus={draft && index === rows.length - 1} value={row.title} onChange={(event) => update(row.key, { title: event.target.value })} placeholder="Nhập nội dung công việc" aria-label={`Nội dung công việc ${index + 1}`} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />{row.error ? <p className="mt-1 text-xs font-semibold text-red-700" role="alert">{row.error}</p> : null}</div></div>
          <div className="mt-2 grid grid-cols-2 gap-2"><label className="grid gap-1 text-[11px] font-semibold text-slate-500">Phân công<select value={row.assignmentState} onChange={(event) => { const assignmentState = event.target.value as Draft["assignmentState"]; update(row.key, { assignmentState, assigneeId: assignmentState === "assigned" ? row.assigneeId : "" }); }} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"><option value="unassigned">{assignmentLabels.unassigned}</option><option value="department_wide">{assignmentLabels.department_wide}</option><option value="assigned">{assignmentLabels.assigned}</option></select></label>{row.assignmentState === "assigned" ? <label className="grid gap-1 text-[11px] font-semibold text-slate-500">Người thực hiện<select value={row.assigneeId} onChange={(event) => update(row.key, { assigneeId: event.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"><option value="">Chọn người</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select></label> : <label className="grid gap-1 text-[11px] font-semibold text-slate-500">Trạng thái<select value={row.workStatus} onChange={(event) => update(row.key, { workStatus: event.target.value as Draft["workStatus"] })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}</div>
          <div className="mt-2 grid grid-cols-2 gap-2"><label className="grid gap-1 text-[11px] font-semibold text-slate-500">Hạn hoàn thành<input type="datetime-local" value={row.dueAt} onChange={(event) => update(row.key, { dueAt: event.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" /></label>{row.assignmentState === "assigned" ? <label className="grid gap-1 text-[11px] font-semibold text-slate-500">Trạng thái<select value={row.workStatus} onChange={(event) => update(row.key, { workStatus: event.target.value as Draft["workStatus"] })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : <div />}</div>
          <div className="mt-3 flex items-center justify-between gap-2">{draft ? <div className="flex gap-1.5"><button type="button" disabled={row.saving} onClick={() => void save(row.key)} className="h-8 rounded-lg bg-orange-600 px-3 text-xs font-bold text-white disabled:opacity-50">{row.saving ? "Đang lưu…" : "Lưu"}</button><button type="button" disabled={row.saving} onClick={() => cancelEdits(row)} className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:opacity-50">Hủy</button></div> : dirty ? <div className="flex gap-1.5"><button type="button" disabled={row.saving} onClick={() => void save(row.key)} className="h-8 rounded-lg bg-orange-600 px-3 text-xs font-bold text-white disabled:opacity-50">{row.saving ? "Đang lưu…" : "Lưu"}</button><button type="button" disabled={row.saving} onClick={() => cancelEdits(row)} className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:opacity-50">Hủy</button></div> : row.linkedTaskId ? <a href={`/tasks/${row.linkedTaskId}`} className="inline-flex h-8 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800">Mở công việc</a> : <button type="button" disabled={row.saving} onClick={() => setAssignmentId(row.id!)} className="h-8 rounded-lg bg-orange-600 px-3 text-xs font-bold text-white disabled:opacity-50">Giao việc</button>} {!draft ? <details className="relative"><summary className="flex h-8 cursor-pointer list-none items-center rounded-lg border border-slate-300 px-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-slate-400 [&::-webkit-details-marker]:hidden" aria-label={`Thao tác mục ${index + 1}`}><span aria-hidden="true">⋯</span><span className="sr-only">Thao tác</span></summary><div className="absolute right-0 bottom-9 z-10 w-36 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"><button type="button" onClick={() => setDetailId(row.id!)} className="block w-full rounded-md px-2.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-orange-50">Chi tiết</button><button type="button" onClick={() => setDetailId(row.id!)} className="block w-full rounded-md px-2.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-orange-50">Chỉnh sửa</button><button type="button" disabled={row.saving} onClick={() => void remove(row)} className="block w-full rounded-md px-2.5 py-2 text-left text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Xóa</button></div></details> : null}</div>
        </article>;
      })}</div>
      {!rows.length ? <p className="py-8 text-center text-sm text-slate-600">Chưa có kế hoạch cho kỳ này. Bấm “+ Thêm dòng” để bắt đầu.</p> : null}
      {detailId ? <DepartmentPlanItemDialog itemId={detailId} period={period} employees={employees} departmentName={departmentName} departmentCode={departmentCode} departmentManagerId={departmentManagerId} scopeKind={scopeKind} assignmentDepartments={assignmentDepartments} assignmentPeople={assignmentPeople} assignmentScope={assignmentScope} onClose={() => setDetailId(null)} onAssigned={(task) => { setRows((current) => current.map((row) => row.id === detailId ? { ...row, linkedTaskId: task.id, dirty: false } : row)); setDetailId(null); setMessage("Đã giao việc."); }} onSaved={(item) => { setRows((current) => current.map((row) => row.id === item.id ? fromItem(item) : row)); setMessage("Đã lưu chi tiết công việc."); }} /> : null}
      {assignmentId ? (() => { const row = rows.find((candidate) => candidate.id === assignmentId); const stored = initialItems.find((candidate) => candidate.id === assignmentId); const item = row?.id ? stored ?? { id: row.id, department_plan_id: plan?.id ?? "", department_id: departmentId, title: row.title, description: null, requirements: null, due_at: row.dueAt ? new Date(row.dueAt).toISOString() : null, assignee_id: row.assigneeId || null, assignment_state: row.assignmentState, work_status: row.workStatus, linked_task_id: row.linkedTaskId, created_by: "", created_at: "", updated_at: "" } satisfies DepartmentPlanItemRow : null; return row && item && !row.dirty ? <DepartmentPlanAssignmentDialog item={item} departmentName={departmentName} departmentCode={departmentCode} departmentManagerId={departmentManagerId} scopeKind={scopeKind} assignmentDepartments={assignmentDepartments} assignmentPeople={assignmentPeople} assignmentScope={assignmentScope} onClose={() => setAssignmentId(null)} onAssigned={(task) => { setRows((current) => current.map((candidate) => candidate.id === assignmentId ? { ...candidate, linkedTaskId: task.id, dirty: false } : candidate)); setAssignmentId(null); setMessage("Đã giao việc."); }} /> : null; })() : null}
    </section>
  );

}
