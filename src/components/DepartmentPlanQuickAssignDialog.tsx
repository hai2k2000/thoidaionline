"use client";

import { useMemo, useState } from "react";
import type { AssignmentPerson } from "@/lib/taskAssignmentRepository";
import type { DepartmentPlanItemRow, DepartmentPlanLinkedTask } from "@/lib/departmentPlanRepository";

type Props = {
  item: DepartmentPlanItemRow;
  assignmentPeople: AssignmentPerson[];
  onClose: () => void;
  onAssigned: (task: DepartmentPlanLinkedTask) => void;
};

const priorities = [
  ["low", "Thấp"],
  ["normal", "Bình thường"],
  ["high", "Cao"],
  ["urgent", "Khẩn cấp"],
] as const;

export default function DepartmentPlanQuickAssignDialog({ item, assignmentPeople, onClose, onAssigned }: Props) {
  const people = useMemo(
    () => assignmentPeople.filter((person) => person.departmentId === item.department_id),
    [assignmentPeople, item.department_id],
  );
  const [assigneeId, setAssigneeId] = useState(item.assignee_id ?? "");
  const [dueDate, setDueDate] = useState(item.due_at?.slice(0, 10) ?? "");
  const [dueTime, setDueTime] = useState(item.due_at?.slice(11, 16) ?? "17:00");
  const [priority, setPriority] = useState<(typeof priorities)[number][0]>("normal");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!assigneeId || !dueDate || !dueTime) {
      setError("Vui lòng chọn người thực hiện và hạn hoàn thành.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/planning/department/items/${item.id}/quick-assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId, dueDate, dueTime, priority, note: note.trim() || null }),
      });
      const payload = await response.json().catch(() => null) as { task?: DepartmentPlanLinkedTask } | null;
      if (!response.ok || !payload?.task) {
        throw new Error(response.status === 403 ? "Bạn không có quyền giao công việc này." : response.status === 409 ? "Công việc này đã được giao." : "Không thể giao việc.");
      }
      onAssigned(payload.task);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể giao việc.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="department-plan-quick-assign-title" className="w-full max-w-xl rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
      <header className="flex items-start justify-between gap-4 border-b border-orange-100 bg-orange-50 px-5 py-4 sm:px-6">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-orange-700">Giao việc nhanh</p><h2 id="department-plan-quick-assign-title" className="mt-1 text-xl font-extrabold text-slate-950">{item.title}</h2><p className="mt-1 text-sm text-slate-600">Task chuẩn sẽ được tạo từ mục kế hoạch này.</p></div>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Đóng" className="rounded-xl p-2 text-2xl leading-none text-slate-500 hover:bg-white">×</button>
      </header>
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
        <label className="grid gap-1 text-sm font-bold text-slate-700 sm:col-span-2">Người thực hiện<select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} disabled={busy} className="h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"><option value="">Chọn người thực hiện</option>{people.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-bold text-slate-700">Hạn hoàn thành<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={busy} className="h-11 rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label>
        <label className="grid gap-1 text-sm font-bold text-slate-700">Giờ<input type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} disabled={busy} className="h-11 rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label>
        <label className="grid gap-1 text-sm font-bold text-slate-700 sm:col-span-2">Mức độ ưu tiên<select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)} disabled={busy} className="h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100">{priorities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-bold text-slate-700 sm:col-span-2">Ghi chú<textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} maxLength={2000} rows={3} placeholder="Không bắt buộc" className="rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label>
      </div>
      {error ? <p role="alert" className="mx-5 mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800 sm:mx-6">{error}</p> : null}
      <footer className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-4 sm:px-6"><button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Hủy</button><button type="button" onClick={() => void submit()} disabled={busy} className="min-h-11 rounded-xl bg-orange-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Đang giao…" : "Giao việc"}</button></footer>
    </div>
  </div>;
}
