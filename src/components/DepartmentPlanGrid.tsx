"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { DepartmentPlanItemRow, DepartmentPlanRow } from "@/lib/departmentPlanRepository";
import type { DepartmentPlanPeriod } from "@/lib/departmentPlanPeriod";
import type { AssignmentDepartment, AssignmentPerson, AssignmentScope } from "@/lib/taskAssignmentRepository";
import DepartmentPlanItemDialog from "@/components/DepartmentPlanItemDialog";
import DepartmentPlanQuickAssignDialog from "@/components/DepartmentPlanQuickAssignDialog";

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
  linkedTaskStatus?: string | null;
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

const linkedTaskStatusLabel = (status: string | null | undefined, linked: boolean) => {
  if (!linked) return "Chưa giao";
  if (status === "new") return "Đã giao";
  if (status === "done") return "Hoàn thành";
  if (status === "cancelled") return "Đã hủy";
  return "Đang thực hiện";
};

const assignmentLabels = {
  unassigned: "Chưa phân công",
  department_wide: "Cả phòng", // Same persisted state previously labeled "Việc chung của phòng".
} as const;

const vietnamDateParts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" });
const toInputDate = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(vietnamDateParts.formatToParts(date).map(({ type, value: part }) => [type, part]));
  return parts.year && parts.month && parts.day ? `${parts.year}-${parts.month}-${parts.day}` : "";
};
const toVietnamIsoDate = (value: string) => `${value}T00:00:00+07:00`;
const assignmentValue = (row: Pick<Draft, "assignmentState" | "assigneeId">) => row.assignmentState === "assigned" ? row.assigneeId : row.assignmentState;
const assignmentPatch = (value: string): Partial<Draft> => value === "unassigned" || value === "department_wide" ? { assignmentState: value as Draft["assignmentState"], assigneeId: "" } : { assignmentState: "assigned", assigneeId: value };
const newDraft = (): Draft => ({ key: `new-${Date.now()}-${Math.random()}`, title: "", assigneeId: "", assignmentState: "unassigned", dueAt: "", workStatus: "planned", linkedTaskId: null, dirty: true, saving: false, error: "" });
const fromItem = (item: DepartmentPlanItemRow): Draft => ({ key: item.id, id: item.id, title: item.title, assigneeId: item.assignee_id ?? "", assignmentState: item.assignment_state, dueAt: toInputDate(item.due_at), workStatus: item.work_status, linkedTaskId: item.linked_task_id, linkedTaskStatus: item.linked_task_status, dirty: false, saving: false, error: "" });

const outsidePeriod = (value: string, period: DepartmentPlanPeriod) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return value < period.periodStart || value > period.periodEnd;
};

const IconActionButton = ({ label, onClick, disabled = false, destructive = false, children }: { label: string; onClick: () => void; disabled?: boolean; destructive?: boolean; children: ReactNode }) => (
  <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-white transition focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50 ${destructive ? "border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700" : "border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
    {children}<span className="sr-only">{label}</span>
  </button>
);

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
    if (row.dueAt && !/^\d{4}-\d{2}-\d{2}$/.test(row.dueAt)) { update(key, { error: "Hạn hoàn thành không hợp lệ." }); return; }
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
      const body = { title: row.title.trim(), assignee_id: row.assignmentState === "assigned" ? row.assigneeId : null, assignment_state: row.assignmentState, due_at: row.dueAt ? new Date(toVietnamIsoDate(row.dueAt)).toISOString() : null, work_status: row.workStatus };
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
      </div>
      {message ? <p role="status" className="mt-3 text-sm font-semibold text-emerald-700">{message}</p> : null}

      <div className="mt-3 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[980px] table-fixed text-sm">
          <caption className="sr-only">Các mục trong kế hoạch phòng ban</caption>
          <colgroup><col className="w-12" /><col /><col className="w-[25%]" /><col className="w-[17%]" /><col className="w-[13%]" /><col className="w-[210px]" /></colgroup>
          <thead><tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500"><th scope="col" className="px-2 py-2">STT</th><th scope="col" className="px-2 py-2">Nội dung công việc</th><th scope="col" className="px-2 py-2">Người thực hiện</th><th scope="col" className="px-2 py-2">Hạn hoàn thành</th><th scope="col" className="px-2 py-2">Trạng thái</th><th scope="col" className="px-2 py-2 text-right">Thao tác</th></tr></thead>
          <tbody>{rows.map((row, index) => {
            const draft = !row.id;
            const dirty = Boolean(row.id && row.dirty);
            const actionLabel = row.linkedTaskId ? "Xem công việc" : "Giao việc nhanh";
            return <tr key={row.key} className={`border-b border-slate-100 align-middle last:border-0 hover:bg-orange-50/40 ${draft ? "bg-slate-50/70" : ""} ${dirty ? "bg-amber-50/50" : ""}`}>
              <td className="px-2 py-2 align-middle font-bold tabular-nums text-slate-400">{index + 1}</td>
              <td className="px-2 py-2 align-middle"><input autoFocus={draft && index === rows.length - 1} value={row.title} onChange={(event) => update(row.key, { title: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void save(row.key); } }} placeholder="Nhập nội dung công việc" aria-label={`Nội dung công việc ${index + 1}`} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />{row.error ? <p className="mt-1 text-xs font-semibold text-red-700" role="alert">{row.error}</p> : null}</td>
              <td className="px-2 py-2 align-middle"><select value={assignmentValue(row)} onChange={(event) => { const value = event.target.value; update(row.key, assignmentPatch(value)); }} aria-label={`Người thực hiện ${index + 1}`} className="h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"><option value="unassigned">{assignmentLabels.unassigned}</option><option value="department_wide">{assignmentLabels.department_wide}</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select></td>
              <td className="px-2 py-2 align-middle"><input type="date" value={row.dueAt} onChange={(event) => update(row.key, { dueAt: event.target.value })} aria-label={`Hạn hoàn thành ${index + 1}`} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />{outsidePeriod(row.dueAt, period) ? <p className="mt-1 text-[11px] text-amber-700">Hạn hoàn thành nằm ngoài kỳ kế hoạch</p> : null}</td>
              <td className="px-2 py-2 align-middle"><select value={row.workStatus} onChange={(event) => update(row.key, { workStatus: event.target.value as Draft["workStatus"] })} aria-label={`Trạng thái công việc ${index + 1}`} disabled={Boolean(row.linkedTaskId)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100">{row.linkedTaskId ? <option value={row.workStatus}>{linkedTaskStatusLabel(row.linkedTaskStatus, true)}</option> : Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
              <td className="px-2 py-2 align-middle"><div className="flex items-center justify-end gap-1.5">
                {draft ? <><button type="button" disabled={row.saving} onClick={() => void save(row.key)} className="h-8 rounded-lg bg-orange-600 px-2.5 text-xs font-bold text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50">{row.saving ? "Đang lưu…" : "Lưu"}</button><button type="button" disabled={row.saving} onClick={() => cancelEdits(row)} className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50">Hủy</button></> : dirty ? <><button type="button" disabled={row.saving} onClick={() => void save(row.key)} className="h-8 rounded-lg bg-orange-600 px-2.5 text-xs font-bold text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50">{row.saving ? "Đang lưu…" : "Lưu"}</button><button type="button" disabled={row.saving} onClick={() => cancelEdits(row)} className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50">Hủy</button></> : row.linkedTaskId ? <a href={`/tasks/${row.linkedTaskId}`} className="inline-flex h-8 min-w-[100px] items-center justify-center whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400">{actionLabel}</a> : <button type="button" disabled={row.saving} onClick={() => setAssignmentId(row.id!)} className="h-8 min-w-[92px] whitespace-nowrap rounded-lg bg-orange-600 px-2.5 text-xs font-bold text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50">{actionLabel}</button>}
                {!draft ? <div className="flex items-center gap-1">
                  <IconActionButton label="Chi tiết" onClick={() => setDetailId(row.id!)}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 10.5v5M12 7.5h.01" /></svg></IconActionButton>
                  <IconActionButton label="Chỉnh sửa" onClick={() => setDetailId(row.id!)}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m4 16.5-.8 4.3 4.3-.8L18.8 8.7a2.2 2.2 0 0 0-3.1-3.1L4 16.5Z" /><path d="m14.5 7.5 2 2" /></svg></IconActionButton>
                  <IconActionButton label="Xóa" destructive disabled={row.saving} onClick={() => void remove(row)}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M9 7V4.5h6V7M7 7l.8 13h8.4L17 7" /></svg></IconActionButton>
                </div> : null}
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
          <div className="mt-2 grid grid-cols-2 gap-2"><label className="grid gap-1 text-[11px] font-semibold text-slate-500">Người thực hiện<select value={assignmentValue(row)} onChange={(event) => { const value = event.target.value; update(row.key, assignmentPatch(value)); }} className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"><option value="unassigned">{assignmentLabels.unassigned}</option><option value="department_wide">{assignmentLabels.department_wide}</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select></label><label className="grid gap-1 text-[11px] font-semibold text-slate-500">Trạng thái<select value={row.workStatus} onChange={(event) => update(row.key, { workStatus: event.target.value as Draft["workStatus"] })} disabled={Boolean(row.linkedTaskId)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
          <div className="mt-2 grid grid-cols-2 gap-2"><label className="grid gap-1 text-[11px] font-semibold text-slate-500">Hạn hoàn thành<input type="date" value={row.dueAt} onChange={(event) => update(row.key, { dueAt: event.target.value })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" /></label><div /></div>
          <div className="mt-3 flex items-center justify-between gap-2">{draft ? <div className="flex gap-1.5"><button type="button" disabled={row.saving} onClick={() => void save(row.key)} className="h-8 rounded-lg bg-orange-600 px-3 text-xs font-bold text-white disabled:opacity-50">{row.saving ? "Đang lưu…" : "Lưu"}</button><button type="button" disabled={row.saving} onClick={() => cancelEdits(row)} className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:opacity-50">Hủy</button></div> : dirty ? <div className="flex gap-1.5"><button type="button" disabled={row.saving} onClick={() => void save(row.key)} className="h-8 rounded-lg bg-orange-600 px-3 text-xs font-bold text-white disabled:opacity-50">{row.saving ? "Đang lưu…" : "Lưu"}</button><button type="button" disabled={row.saving} onClick={() => cancelEdits(row)} className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:opacity-50">Hủy</button></div> : row.linkedTaskId ? <a href={`/tasks/${row.linkedTaskId}`} className="inline-flex h-8 min-w-[100px] items-center justify-center whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800">Xem công việc</a> : <button type="button" disabled={row.saving} onClick={() => setAssignmentId(row.id!)} className="h-8 min-w-[92px] whitespace-nowrap rounded-lg bg-orange-600 px-3 text-xs font-bold text-white disabled:opacity-50">Giao việc nhanh</button>} {!draft ? <div className="flex items-center gap-1">
                  <IconActionButton label="Chi tiết" onClick={() => setDetailId(row.id!)}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 10.5v5M12 7.5h.01" /></svg></IconActionButton>
                  <IconActionButton label="Chỉnh sửa" onClick={() => setDetailId(row.id!)}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m4 16.5-.8 4.3 4.3-.8L18.8 8.7a2.2 2.2 0 0 0-3.1-3.1L4 16.5Z" /><path d="m14.5 7.5 2 2" /></svg></IconActionButton>
                  <IconActionButton label="Xóa" destructive disabled={row.saving} onClick={() => void remove(row)}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M9 7V4.5h6V7M7 7l.8 13h8.4L17 7" /></svg></IconActionButton>
                </div> : null}</div>
        </article>;
      })}</div>
      <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
        <button type="button" onClick={() => { setRows((current) => [...current, newDraft()]); setMessage(""); }} className="min-h-9 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-bold text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2">+ Thêm dòng</button>
      </div>
      {!rows.length ? <p className="py-8 text-center text-sm text-slate-600">Chưa có kế hoạch cho kỳ này. Bấm “+ Thêm dòng” để bắt đầu.</p> : null}
          {detailId ? <DepartmentPlanItemDialog itemId={detailId} period={period} employees={employees} departmentName={departmentName} departmentCode={departmentCode} departmentManagerId={departmentManagerId} scopeKind={scopeKind} assignmentDepartments={assignmentDepartments} assignmentPeople={assignmentPeople} assignmentScope={assignmentScope} onClose={() => setDetailId(null)} onAssigned={(task) => { setRows((current) => current.map((row) => row.id === detailId ? { ...row, linkedTaskId: task.id, linkedTaskStatus: "new", dirty: false } : row)); setDetailId(null); setMessage("Đã giao việc."); }} onSaved={(item) => { setRows((current) => current.map((row) => row.id === item.id ? fromItem(item) : row)); setMessage("Đã lưu chi tiết công việc."); }} /> : null}
      {assignmentId ? (() => { const row = rows.find((candidate) => candidate.id === assignmentId); const stored = initialItems.find((candidate) => candidate.id === assignmentId); const item = row?.id ? stored ?? { id: row.id, department_plan_id: plan?.id ?? "", department_id: departmentId, title: row.title, description: null, requirements: null, due_at: row.dueAt ? new Date(toVietnamIsoDate(row.dueAt)).toISOString() : null, assignee_id: row.assigneeId || null, assignment_state: row.assignmentState, work_status: row.workStatus, linked_task_id: row.linkedTaskId, created_by: "", created_at: "", updated_at: "" } satisfies DepartmentPlanItemRow : null; return row && item && !row.dirty ? <DepartmentPlanQuickAssignDialog item={item} assignmentPeople={assignmentPeople} onClose={() => setAssignmentId(null)} onAssigned={(task) => { setRows((current) => current.map((candidate) => candidate.id === assignmentId ? { ...candidate, linkedTaskId: task.id, linkedTaskStatus: "new", dirty: false } : candidate)); setAssignmentId(null); setMessage("Đã giao việc."); }} /> : null; })() : null}
    </section>
  );

}
