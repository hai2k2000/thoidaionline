"use client";

import type { DepartmentPlanItemRow } from "@/lib/departmentPlanRepository";

export type DepartmentPlanItemDraft = {
  title: string;
  description: string;
  requirements: string;
  dueAt: string;
  workStatus: DepartmentPlanItemRow["work_status"];
};

type Props = {
  value: DepartmentPlanItemDraft;
  onChange: (patch: Partial<DepartmentPlanItemDraft>) => void;
  disabled?: boolean;
};

const statusLabels: Record<DepartmentPlanItemDraft["workStatus"], string> = {
  planned: "Chưa bắt đầu",
  in_progress: "Đang thực hiện",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

export default function DepartmentPlanItemFields({ value, onChange, disabled = false }: Props) {
  return (
    <div className="grid gap-4">
      <label className="grid gap-1.5 text-sm font-bold text-slate-700">Nội dung công việc<input autoFocus value={value.title} onChange={(event) => onChange({ title: event.target.value })} disabled={disabled} className="min-h-11 rounded-xl border px-3 py-2 font-normal" /></label>
      <label className="grid gap-1.5 text-sm font-bold text-slate-700">Mô tả<textarea value={value.description} onChange={(event) => onChange({ description: event.target.value })} disabled={disabled} rows={4} className="min-h-28 resize-y rounded-xl border px-3 py-2 font-normal" /></label>
      <label className="grid gap-1.5 text-sm font-bold text-slate-700">Yêu cầu<textarea value={value.requirements} onChange={(event) => onChange({ requirements: event.target.value })} disabled={disabled} rows={3} className="min-h-24 resize-y rounded-xl border px-3 py-2 font-normal" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">Hạn hoàn thành<input type="datetime-local" value={value.dueAt} onChange={(event) => onChange({ dueAt: event.target.value })} disabled={disabled} className="min-h-11 rounded-xl border px-3 py-2 font-normal" /></label>
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">Trạng thái<select value={value.workStatus} onChange={(event) => onChange({ workStatus: event.target.value as DepartmentPlanItemDraft["workStatus"] })} disabled={disabled} className="min-h-11 rounded-xl border px-3 py-2 font-normal">{Object.entries(statusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label>
      </div>
    </div>
  );
}
