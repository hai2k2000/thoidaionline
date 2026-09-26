"use client";

import { useEffect, useMemo, useState } from "react";
import DepartmentPlanItemFields, { type DepartmentPlanItemDraft } from "@/components/DepartmentPlanItemFields";
import type { DepartmentPlanItemRow } from "@/lib/departmentPlanRepository";
import type { DepartmentPlanPeriod } from "@/lib/departmentPlanPeriod";

type Props = {
  itemId: string;
  period: DepartmentPlanPeriod;
  employees: Array<{ id: string; full_name: string }>;
  onClose: () => void;
  onSaved: (item: DepartmentPlanItemRow) => void;
};

const inputDate = (value: string | null) => value ? value.slice(0, 16) : "";
const draftFromItem = (item: DepartmentPlanItemRow): DepartmentPlanItemDraft => ({ title: item.title, description: item.description ?? "", requirements: item.requirements ?? "", dueAt: inputDate(item.due_at), assigneeId: item.assignee_id ?? "", assignmentState: item.assignment_state, workStatus: item.work_status });
const outsidePeriod = (value: string, period: DepartmentPlanPeriod) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date < new Date(`${period.periodStart}T00:00:00`) || date > new Date(`${period.periodEnd}T23:59:59`);
};

export default function DepartmentPlanItemDialog({ itemId, period, employees, onClose, onSaved }: Props) {
  const [item, setItem] = useState<DepartmentPlanItemRow | null>(null);
  const [original, setOriginal] = useState<DepartmentPlanItemDraft | null>(null);
  const [draft, setDraft] = useState<DepartmentPlanItemDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dirty = useMemo(() => Boolean(original && draft && JSON.stringify(original) !== JSON.stringify(draft)), [draft, original]);

  useEffect(() => {
    let active = true;
    void fetch(`/api/planning/department/items/${itemId}`).then(async (response) => {
      if (!response.ok) throw new Error("Không thể tải chi tiết công việc.");
      return response.json() as Promise<{ item: DepartmentPlanItemRow }>;
    }).then((payload) => {
      if (!active) return;
      const next = draftFromItem(payload.item);
      setItem(payload.item); setOriginal(next); setDraft(next);
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Không thể tải chi tiết công việc."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [itemId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (!dirty || window.confirm("Bạn có thay đổi chưa lưu. Đóng và bỏ thay đổi?")) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dirty, onClose]);

  const update = (patch: Partial<DepartmentPlanItemDraft>) => setDraft((current) => current ? { ...current, ...patch } : current);
  const cancelChanges = () => {
    if (!original) return;
    if (dirty && !window.confirm("Hủy thay đổi và khôi phục dữ liệu ban đầu?")) return;
    setDraft({ ...original }); setError("");
  };
  const close = () => {
    if (dirty && !window.confirm("Bạn có thay đổi chưa lưu. Đóng và bỏ thay đổi?")) return;
    onClose();
  };
  const save = async () => {
    if (!item || !draft) return;
    if (!draft.title.trim()) { setError("Vui lòng nhập nội dung công việc."); return; }
    if (draft.dueAt && Number.isNaN(Date.parse(draft.dueAt))) { setError("Hạn hoàn thành không hợp lệ."); return; }
    if (draft.assignmentState === "assigned" && !draft.assigneeId) { setError("Vui lòng chọn người thực hiện."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/planning/department/items/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: draft.title.trim(), description: draft.description || null, requirements: draft.requirements || null, due_at: draft.dueAt ? new Date(draft.dueAt).toISOString() : null, assignee_id: draft.assignmentState === "assigned" ? draft.assigneeId : null, assignment_state: draft.assignmentState, work_status: draft.workStatus }) });
      if (!response.ok) throw new Error(response.status === 403 ? "Bạn không có quyền cập nhật công việc này." : "Không thể lưu chi tiết công việc.");
      const payload = await response.json() as { item: DepartmentPlanItemRow };
      const savedItem = { ...payload.item, created_by_name: item.created_by_name };
      const next = draftFromItem(savedItem); setItem(savedItem); setOriginal(next); setDraft(next); onSaved(savedItem);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể lưu chi tiết công việc."); } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="department-plan-item-dialog-title" className="flex max-h-[96vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-3xl">
      <header className="flex items-start justify-between gap-4 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-4 sm:px-6"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-orange-700">Công việc trong kế hoạch phòng</p><h2 id="department-plan-item-dialog-title" className="mt-1 text-xl font-extrabold text-slate-950">CHI TIẾT CÔNG VIỆC</h2></div><button type="button" onClick={close} aria-label="Đóng" className="rounded-xl p-2 text-2xl leading-none text-slate-500 hover:bg-white hover:text-slate-900">×</button></header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{loading ? <p className="py-12 text-center text-sm text-slate-600">Đang tải chi tiết…</p> : !item || !draft ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error || "Không thể tải chi tiết công việc."}</p> : <><DepartmentPlanItemFields value={draft} employees={employees} onChange={update} disabled={saving} />{outsidePeriod(draft.dueAt, period) ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Hạn hoàn thành nằm ngoài kỳ kế hoạch.</p> : null}<dl className="mt-5 grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-3"><div><dt className="font-bold text-slate-500">Tạo bởi</dt><dd className="mt-1 break-words text-slate-800">{item.created_by_name || item.created_by}</dd></div><div><dt className="font-bold text-slate-500">Tạo lúc</dt><dd className="mt-1 text-slate-800">{item.created_at}</dd></div><div><dt className="font-bold text-slate-500">Cập nhật lúc</dt><dd className="mt-1 text-slate-800">{item.updated_at}</dd></div></dl>{error ? <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}</>}</div>
      <footer className="flex flex-wrap justify-end gap-2 border-t bg-white px-5 py-4 sm:px-6"><button type="button" onClick={cancelChanges} disabled={!dirty || saving} className="min-h-11 rounded-xl border px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40">Hủy thay đổi</button><button type="button" onClick={close} disabled={saving} className="min-h-11 rounded-xl border px-4 py-2 text-sm font-bold text-slate-700">Đóng</button><button type="button" onClick={() => void save()} disabled={!item || !draft || saving || !dirty} className="min-h-11 rounded-xl bg-orange-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-40">{saving ? "Đang lưu…" : "Lưu"}</button></footer>
    </div>
  </div>;
}
