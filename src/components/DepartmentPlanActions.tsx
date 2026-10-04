"use client";

import { useRef, useState } from "react";
import type { DepartmentPlanItemRow, DepartmentPlanRow } from "@/lib/departmentPlanRepository";
import type { DepartmentPlanPeriod } from "@/lib/departmentPlanPeriod";
import { departmentPlanUrl, formatDepartmentPlanPeriod } from "@/lib/departmentPlanNavigation";

type Candidate = { rowNumber?: number; taskId?: string | null; title: string; description?: string | null; assigneeNames?: string[]; collaboratorNames?: string[]; assigneeIds?: string[]; collaboratorIds?: string[]; assigneeName?: string | null; assigneeMatches?: Array<{ name: string; matches: Array<{ id: string; full_name: string }> }>; collaboratorMatches?: Array<{ name: string; matches: Array<{ id: string; full_name: string }> }>; mappingConfidence?: "HIGH" | "REVIEW" | "UNRESOLVED"; mappingBlocking?: boolean; assignmentDifference?: boolean; startDate?: string | null; dueDate?: string | null; milestone?: string | null; periodRelation: string; workSource?: string | null; status?: string | null; previousItemId?: string | null; carryOverReason?: string | null; existingTask?: { id: string; title: string; assigneeId?: string | null; confidence: "HIGH" | "REVIEW" } | null; alreadyInPlan?: boolean; warning?: string | null };

const candidateKey = (item: Candidate) => item.taskId ?? `${item.rowNumber ?? "row"}:${item.title}`;
const candidateBlocked = (item: Candidate, key: string, overrides: Record<string, string[]>, links: Record<string, boolean>) => {
  const required = item.assigneeNames?.length ?? 0;
  const resolved = overrides[key] ?? item.assigneeIds ?? [];
  return (required > 0 && resolved.length < required) || Boolean(item.assignmentDifference && !links[key]);
};

export default function DepartmentPlanActions({ departmentId, period, plan, items }: { departmentId: string; period: DepartmentPlanPeriod; plan: DepartmentPlanRow | null; items: DepartmentPlanItemRow[] }) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [linkExisting, setLinkExisting] = useState<Record<string, boolean>>({});
  const [assigneeOverrides, setAssigneeOverrides] = useState<Record<string, string[]>>({});
  const [collaboratorOverrides, setCollaboratorOverrides] = useState<Record<string, string[]>>({});
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ id: string; full_name: string }>>([]);
  const [message, setMessage] = useState("");
  const [existingPlan, setExistingPlan] = useState<DepartmentPlanRow | null>(null);
  const [noPlanImport, setNoPlanImport] = useState(false);
  const [importingExistingPlan, setImportingExistingPlan] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const actionLockRef = useRef(false);
  const openExisting = (target: DepartmentPlanRow) => {
    setOpen(false);
    setExistingPlan(target);
  };
  const openExistingPlan = () => {
    if (!existingPlan) return;
    window.location.assign(departmentPlanUrl(period.periodType, period.periodStart, departmentId));
  };
  const preview = async () => {
    if (plan) {
      openExisting(plan);
      return;
    }
    setImportingExistingPlan(false);
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setBusy(true); setMessage("");
    try {
      const query = new URLSearchParams({ departmentId, periodType: period.periodType, periodStart: period.periodStart });
      const response = await fetch(`/api/planning/department/candidates?${query}`);
      if (!response.ok) throw new Error("Không thể quét công việc đề xuất.");
      const data = await response.json() as { candidates?: Candidate[]; existingPlan?: DepartmentPlanRow | null };
      if (data.existingPlan) {
        openExisting(data.existingPlan);
        return;
      }
      setCandidates(data.candidates ?? []); setSelected((data.candidates ?? []).map(candidateKey)); setOpen(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể quét công việc đề xuất."); }
    finally { actionLockRef.current = false; setBusy(false); }
  };
  const create = async () => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setBusy(true);
    try {
      const selectedItems = candidates.filter((item) => selected.includes(candidateKey(item))).map((item) => ({
        taskId: item.taskId ?? (item.existingTask && linkExisting[candidateKey(item)] ? item.existingTask.id : null),
        title: item.title,
        description: item.description,
        assigneeIds: assigneeOverrides[candidateKey(item)] ?? item.assigneeIds ?? [],
        collaboratorIds: collaboratorOverrides[candidateKey(item)] ?? item.collaboratorIds ?? [],
        assigneeRequired: Boolean(item.assigneeNames?.length),
        dueDate: item.dueDate,
        status: item.status ?? "planned",
        workSource: item.workSource ?? "department_plan",
        milestone: item.milestone ?? null,
        periodRelation: item.periodRelation,
        carryOverReason: item.carryOverReason,
      }));
      const response = importingExistingPlan
        ? await fetch("/api/planning/department/import/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current_plan_id: plan?.id, department_id: departmentId, periodType: period.periodType, periodStart: period.periodStart, periodEnd: period.periodEnd, items: selectedItems }) })
        : await fetch("/api/planning/department/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ departmentId, periodType: period.periodType, periodStart: period.periodStart, items: selectedItems.map((item) => ({ ...((item.taskId) ? { taskId: item.taskId } : { title: item.title, description: item.description, dueAt: item.dueDate ? `${item.dueDate}T17:00:00+07:00` : null, workStatus: item.status ?? "planned", workSource: item.workSource ?? "department_plan", periodMilestoneAt: item.milestone ? `${item.milestone}T17:00:00+07:00` : null }), periodRelation: item.periodRelation, carryOverReason: item.carryOverReason })) }) });
      const data = await response.json().catch(() => null) as { skipped?: Array<unknown>; existingPlan?: DepartmentPlanRow | null; plan?: DepartmentPlanRow; created?: boolean; error?: { message?: string } } | null;
      if (!response.ok) throw new Error(data?.error?.message ?? (importingExistingPlan ? "Không thể import vào kế hoạch hiện tại." : "Không thể tạo kế hoạch kỳ mới."));
      if (!importingExistingPlan && (data?.existingPlan || data?.created === false)) {
        const target = data?.existingPlan ?? data?.plan;
        if (target) openExisting(target);
        return;
      }
      if (importingExistingPlan) {
        setOpen(false);
        setMessage(`Đã import vào kế hoạch hiện tại. Bỏ qua ${data?.skipped?.length ?? 0} dòng trùng.`);
        window.location.reload();
        return;
      }
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể tạo kế hoạch kỳ mới."); }
    finally { actionLockRef.current = false; setBusy(false); }
  };
  const close = async () => {
    if (!plan || actionLockRef.current || !window.confirm("Chốt kỳ này và lưu snapshot kết quả?")) return;
    actionLockRef.current = true;
    setBusy(true);
    try {
      const response = await fetch(`/api/planning/department/${plan.id}/close`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decisions: items.map((item) => ({ itemId: item.id, carryForward: item.work_status !== "completed" && item.work_status !== "cancelled" })) }) });
      if (!response.ok) throw new Error("Không thể chốt kỳ kế hoạch.");
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể chốt kỳ kế hoạch."); }
    finally { actionLockRef.current = false; setBusy(false); }
  };
  const importExcel = async (file: File) => {
    if (!plan) {
      setNoPlanImport(true);
      return;
    }
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setBusy(true);
    try {
      const body = new FormData(); body.set("file", file); body.set("department_id", departmentId); body.set("current_plan_id", plan.id); body.set("periodType", period.periodType); body.set("periodStart", period.periodStart); body.set("periodEnd", period.periodEnd);
      const response = await fetch("/api/planning/department/import", { method: "POST", body });
      const data = await response.json().catch(() => null) as { candidates?: Candidate[]; employeeOptions?: Array<{ id: string; full_name: string }>; message?: string; error?: { message?: string } } | null;
      if (!response.ok) throw new Error(data?.message ?? data?.error?.message ?? "File Excel không hợp lệ.");
      const importedCandidates = data?.candidates ?? [];
      setCandidates(importedCandidates); setEmployeeOptions(data?.employeeOptions ?? []); setSelected(importedCandidates.filter((item) => !item.mappingBlocking && !item.alreadyInPlan).map(candidateKey)); setLinkExisting(Object.fromEntries(importedCandidates.filter((item) => item.existingTask && !item.alreadyInPlan && item.existingTask.confidence === "HIGH" && !item.assignmentDifference).map((item) => [candidateKey(item), true]))); setAssigneeOverrides({}); setCollaboratorOverrides({}); setImportingExistingPlan(true); setOpen(true); setMessage("Đã tạo bản xem trước. Kiểm tra người thực hiện rồi bấm Xác nhận và giao việc.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "File Excel không hợp lệ."); }
    finally { actionLockRef.current = false; setBusy(false); }
  };
  return <>
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3 shadow-sm">
      <button type="button" onClick={() => void preview()} disabled={busy} className="min-h-10 rounded-xl bg-orange-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Đang xử lý…" : "Tạo kế hoạch kỳ mới"}</button>
      <button type="button" onClick={() => plan ? fileRef.current?.click() : setNoPlanImport(true)} disabled={busy} className="min-h-10 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-900 disabled:opacity-50">Import kế hoạch từ Excel</button>
      <a href="/api/planning/department/template" download="Mau_Import_Ke_Hoach_Phong.xlsx" className="inline-flex min-h-10 items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50">Tải file Excel mẫu</a>
      <input ref={fileRef} hidden type="file" accept=".xlsx" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importExcel(file); event.currentTarget.value = ""; }} />
      {plan?.status !== "closed" && plan ? <button type="button" onClick={() => void close()} disabled={busy} className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 disabled:opacity-50">Chốt kỳ</button> : null}
      {message ? <span role="status" className="text-sm font-semibold text-slate-600">{message}</span> : null}
    </div>
    {existingPlan ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="existing-department-plan-title"><h2 id="existing-department-plan-title" className="text-lg font-extrabold text-slate-900">Kế hoạch kỳ này đã tồn tại.</h2><p className="mt-2 text-sm leading-6 text-slate-600">{formatDepartmentPlanPeriod(period.periodType, period.periodStart, period.periodEnd)} đã được tạo cho phòng ban này.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setExistingPlan(null)} className="rounded-lg border px-3 py-2 text-sm font-bold text-slate-700">Đóng</button><button type="button" onClick={openExistingPlan} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white">Mở kế hoạch</button></div></section></div> : null}
    {noPlanImport ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="no-department-plan-title"><h2 id="no-department-plan-title" className="text-lg font-extrabold text-slate-900">Kỳ này chưa có kế hoạch.</h2><p className="mt-2 text-sm leading-6 text-slate-600">Hãy tạo kế hoạch kỳ mới trước khi import Excel.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setNoPlanImport(false)} className="rounded-lg border px-3 py-2 text-sm font-bold text-slate-700">Đóng</button><button type="button" onClick={() => { setNoPlanImport(false); void preview(); }} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white">Tạo kế hoạch kỳ mới</button></div></section></div> : null}
    {open ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><section className="max-h-[85vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="Xem trước kế hoạch kỳ mới"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">Xem trước kế hoạch kỳ mới</h2><p className="text-sm text-slate-500">Kiểm tra người thực hiện trước khi xác nhận và giao việc.</p></div><button type="button" onClick={() => { setOpen(false); setImportingExistingPlan(false); }} className="rounded-lg border px-3 py-1.5 text-sm font-bold">Đóng</button></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[920px] text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="p-2">Chọn</th><th className="p-2">Tên công việc</th><th className="p-2">Người thực hiện</th><th className="p-2">Bắt đầu</th><th className="p-2">Hạn</th><th className="p-2">Quan hệ kỳ</th><th className="p-2">Task</th><th className="p-2">Trạng thái mapping</th></tr></thead><tbody>{candidates.map((item) => { const key = candidateKey(item); const override = assigneeOverrides[key] ?? item.assigneeIds ?? []; const blocked = candidateBlocked(item, key, assigneeOverrides, linkExisting); const saveOverride = (id: string) => setAssigneeOverrides((current) => ({ ...current, [key]: id ? [...new Set([...override, id])] : override })); return <tr key={key} className="border-b align-top"><td className="p-2"><input type="checkbox" checked={selected.includes(key)} disabled={blocked || item.alreadyInPlan} onChange={() => setSelected((current) => current.includes(key) ? current.filter((id) => id !== key) : [...current, key])} aria-label={`Chọn ${item.title}`} /></td><td className="p-2 font-semibold">{item.title}{item.warning ? <span className="ml-2 text-xs font-semibold text-amber-700">{item.warning}</span> : null}</td><td className="p-2"><div>{item.assigneeName ?? "—"}</div>{item.assigneeMatches?.filter((entry) => entry.matches.length !== 1).map((entry) => <select key={entry.name} value={override.find((id) => entry.matches.some((match) => match.id === id)) ?? ""} onChange={(event) => saveOverride(event.target.value)} className="mt-1 rounded border px-2 py-1 text-xs"><option value="">Chọn tài khoản cho {entry.name}</option>{(entry.matches.length ? entry.matches : employeeOptions).map((match) => <option key={match.id} value={match.id}>{match.full_name}</option>)}</select>)}</td><td className="p-2 whitespace-nowrap">{item.startDate ?? "—"}</td><td className="p-2 whitespace-nowrap">{item.dueDate ?? "—"}</td><td className="p-2">{item.periodRelation === "LONG_RUNNING" ? "Dài hạn" : item.periodRelation === "CARRY_OVER" ? "Chuyển tiếp" : item.periodRelation === "RECURRING" ? "Định kỳ" : item.periodRelation === "AUTO_ADDED_DURING_PERIOD" ? "Phát sinh trong kỳ" : item.periodRelation === "IMPORTED" ? "Import" : "Mới"}</td><td className="p-2">{item.existingTask ? <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(item.taskId || linkExisting[key])} disabled={Boolean(item.taskId || item.alreadyInPlan)} onChange={(event) => setLinkExisting((current) => ({ ...current, [key]: event.target.checked }))} /><span>{item.existingTask.confidence === "HIGH" ? "Existing" : "Review"}: {item.existingTask.title}</span></label> : "New Task"}</td><td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${blocked ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{item.assignmentDifference ? "Assignment difference — xem xét trước khi link" : item.mappingConfidence === "HIGH" ? "Đã xác định người thực hiện — sẽ giao việc" : item.mappingConfidence === "UNRESOLVED" ? "Cần chọn người thực hiện" : item.mappingConfidence === "REVIEW" ? "Cần xác nhận người thực hiện" : "Chưa có người thực hiện"}</span></td></tr>; })}</tbody></table></div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setSelected(candidates.filter((item) => !item.alreadyInPlan && !candidateBlocked(item, candidateKey(item), assigneeOverrides, linkExisting)).map(candidateKey))} className="rounded-lg border px-3 py-2 text-sm font-semibold">Chọn dòng hợp lệ</button><button type="button" disabled={busy || candidates.some((item) => candidateBlocked(item, candidateKey(item), assigneeOverrides, linkExisting) && selected.includes(candidateKey(item)))} onClick={() => void create()} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{importingExistingPlan ? "Xác nhận và giao việc" : "Xác nhận tạo kế hoạch"}</button></div></section></div> : null}
  </>;
}
