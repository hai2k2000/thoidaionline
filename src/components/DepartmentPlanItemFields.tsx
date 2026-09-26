"use client";

import type { DepartmentPlanItemRow } from "@/lib/departmentPlanRepository";

export type DepartmentPlanItemDraft = {
  title: string;
  description: string;
  requirements: string;
  dueAt: string;
  assigneeId: string;
  assignmentState: DepartmentPlanItemRow["assignment_state"];
  workStatus: DepartmentPlanItemRow["work_status"];
};

type Props = {
  value: DepartmentPlanItemDraft;
  employees: Array<{ id: string; full_name: string }>;
  onChange: (patch: Partial<DepartmentPlanItemDraft>) => void;
  disabled?: boolean;
};

const statusLabels: Record<DepartmentPlanItemDraft["workStatus"], string> = {
  planned: "Chưa bắt đầu",
  in_progress: "Đang thực hiện",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

export default function DepartmentPlanItemFields({ value, employees, onChange, disabled = false }: Props) {
  return (
    <div className="grid gap-4">
      <label className="grid gap-1.5 text-sm font-bold text-slate-700">Nội dung công việc<input autoFocus value={value.title} onChange={(event) => onChange({ title: event.target.value })} disabled={disabled} className="min-h-11 rounded-xl border px-3 py-2 font-normal" /></label>
      <label className="grid gap-1.5 text-sm font-bold text-slate-700">Mô tả<textarea value={value.description} onChange={(event) => onChange({ description: event.target.value })} disabled={disabled} rows={4} className="min-h-28 resize-y rounded-xl border px-3 py-2 font-normal" /></label>
      <label className="grid gap-1.5 text-sm font-bold text-slate-700">Yêu cầu<textarea value={value.requirements} onChange={(event) => onChange({ requirements: event.target.value })} disabled={disabled} rows={3} className="min-h-24 resize-y rounded-xl border px-3 py-2 font-normal" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">Hạn hoàn thành<input type="datetime-local" value={value.dueAt} onChange={(event) => onChange({ dueAt: event.target.value })} disabled={disabled} className="min-h-11 rounded-xl border px-3 py-2 font-normal" /></label>
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">Trạng thái<select value={value.workStatus} onChange={(event) => onChange({ workStatus: event.target.value as DepartmentPlanItemDraft["workStatus"] })} disabled={disabled} className="min-h-11 rounded-xl border px-3 py-2 font-normal">{Object.entries(statusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">Phân công<select value={value.assignmentState} onChange={(event) => { const assignmentState = event.target.value as DepartmentPlanItemDraft["assignmentState"]; onChange({ assignmentState, assigneeId: assignmentState === "assigned" ? value.assigneeId : "" }); }} disabled={disabled} className="min-h-11 rounded-xl border px-3 py-2 font-normal"><option value="unassigned">Chưa phân công</option><option value="department_wide">Việc chung của phòng</option><option value="assigned">Có người thực hiện</option></select></label>
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">Người thực hiện<select value={value.assigneeId} onChange={(event) => onChange({ assigneeId: event.target.value })} disabled={disabled || value.assignmentState !== "assigned"} className="min-h-11 rounded-xl border px-3 py-2 font-normal"><option value="">{value.assignmentState === "assigned" ? "Chọn người" : "Không áp dụng"}</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select></label>
      </div>
    </div>
  );
}
