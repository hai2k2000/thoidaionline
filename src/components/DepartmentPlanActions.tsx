"use client";

import { useRef, useState } from "react";
import type { DepartmentPlanItemRow, DepartmentPlanRow } from "@/lib/departmentPlanRepository";
import type { DepartmentPlanPeriod } from "@/lib/departmentPlanPeriod";
import { departmentPlanUrl, formatDepartmentPlanPeriod } from "@/lib/departmentPlanNavigation";

type Candidate = { rowNumber?: number; taskId?: string | null; title: string; description?: string | null; assigneeId?: string | null; assigneeName?: string | null; mappingConfidence?: "HIGH" | "REVIEW" | "UNRESOLVED"; dueDate?: string | null; milestone?: string | null; periodRelation: string; workSource?: string | null; status?: string | null; previousItemId?: string | null; carryOverReason?: string | null; existingTask?: { id: string; title: string; confidence: "HIGH" | "REVIEW" } | null; alreadyInPlan?: boolean; warning?: string | null };

const candidateKey = (item: Candidate) => item.taskId ?? `${item.rowNumber ?? "row"}:${item.title}`;

export default function DepartmentPlanActions({ departmentId, period, plan, items }: { departmentId: string; period: DepartmentPlanPeriod; plan: DepartmentPlanRow | null; items: DepartmentPlanItemRow[] }) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [linkExisting, setLinkExisting] = useState<Record<string, boolean>>({});
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
      const data = await response.json().catch(() => null) as { candidates?: Candidate[]; error?: { message?: string } } | null;
      if (!response.ok) throw new Error(data?.error?.message ?? "File Excel không hợp lệ.");
      const importedCandidates = data?.candidates ?? [];
      setCandidates(importedCandidates); setSelected(importedCandidates.map(candidateKey)); setLinkExisting(Object.fromEntries(importedCandidates.filter((item) => item.existingTask && !item.alreadyInPlan && item.existingTask.confidence === "HIGH").map((item) => [candidateKey(item), true]))); setImportingExistingPlan(true); setOpen(true); setMessage("Đã tạo bản xem trước từ file Excel. Chưa lưu dữ liệu.");
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
    {open ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><section className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="Xem trước kế hoạch kỳ mới"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">Xem trước kế hoạch kỳ mới</h2><p className="text-sm text-slate-500">Chọn các công việc đề xuất trước khi lưu.</p></div><button type="button" onClick={() => { setOpen(false); setImportingExistingPlan(false); }} className="rounded-lg border px-3 py-1.5 text-sm font-bold">Đóng</button></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="p-2">Chọn</th><th className="p-2">Công việc</th><th className="p-2">Quan hệ kỳ</th><th className="p-2">Người thực hiện</th><th className="p-2">Khớp việc cũ</th><th className="p-2">Hạn</th></tr></thead><tbody>{candidates.map((item) => <tr key={candidateKey(item)} className="border-b"><td className="p-2"><input type="checkbox" checked={selected.includes(candidateKey(item))} onChange={() => setSelected((current) => current.includes(candidateKey(item)) ? current.filter((id) => id !== candidateKey(item)) : [...current, candidateKey(item)])} aria-label={`Chọn ${item.title}`} /></td><td className="p-2 font-semibold">{item.title}{item.warning ? <span className="ml-2 text-xs font-semibold text-amber-700">{item.warning}</span> : null}</td><td className="p-2">{item.periodRelation === "LONG_RUNNING" ? "Dài hạn" : item.periodRelation === "CARRY_OVER" ? "Chuyển tiếp" : item.periodRelation === "RECURRING" ? "Định kỳ" : item.periodRelation === "AUTO_ADDED_DURING_PERIOD" ? "Phát sinh trong kỳ" : item.periodRelation === "IMPORTED" ? "Import" : "Mới"}</td><td className="p-2"><span>{item.assigneeName ?? "—"}</span>{item.mappingConfidence ? <small className={`ml-2 rounded-full px-2 py-0.5 font-bold ${item.mappingConfidence === "HIGH" ? "bg-emerald-100 text-emerald-800" : item.mappingConfidence === "REVIEW" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{item.mappingConfidence}</small> : null}</td><td className="p-2">{item.existingTask ? <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(item.taskId || linkExisting[candidateKey(item)])} disabled={Boolean(item.taskId || item.alreadyInPlan)} onChange={(event) => setLinkExisting((current) => ({ ...current, [candidateKey(item)]: event.target.checked }))} /><span>{item.existingTask.confidence === "HIGH" ? "Khớp cao" : "Cần xác nhận"}: {item.existingTask.title}</span></label> : "Tạo mới"}</td><td className="p-2">{item.dueDate ?? "—"}</td></tr>)}</tbody></table></div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setSelected(candidates.map(candidateKey))} className="rounded-lg border px-3 py-2 text-sm font-semibold">Chọn tất cả</button><button type="button" disabled={busy} onClick={() => void create()} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{importingExistingPlan ? "Xác nhận import" : "Xác nhận tạo kế hoạch"}</button></div></section></div> : null}
  </>;
}
