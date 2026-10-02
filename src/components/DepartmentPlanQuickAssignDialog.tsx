"use client";

import { useMemo, useState } from "react";
import type { AssignmentPerson } from "@/lib/taskAssignmentRepository";
import type { DepartmentPlanItemRow, DepartmentPlanLinkedTask } from "@/lib/departmentPlanRepository";

type Props = {
  item: DepartmentPlanItemRow;
  assignmentPeople: AssignmentPerson[];
  onClose: () => void;
  onAssigned: (task: DepartmentPlanLinkedTask, item?: DepartmentPlanItemRow) => void;
  planId?: string;
  isDraft?: boolean;
  draftDueAt?: string;
};

const priorities = [
  ["low", "Thấp"],
  ["normal", "Bình thường"],
  ["high", "Cao"],
  ["urgent", "Khẩn cấp"],
] as const;

const dateTimeParts = (value: string | null | undefined) => {
  if (!value) return { date: "", time: "17:00" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "", time: "17:00" };
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
};

const requirementsFromItem = (value: string | null) => value?.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean) ?? [];

export default function DepartmentPlanQuickAssignDialog({ item, assignmentPeople, onClose, onAssigned, planId, isDraft = false, draftDueAt }: Props) {
  const people = useMemo(
    () => assignmentPeople.filter((person) => person.departmentId === item.department_id),
    [assignmentPeople, item.department_id],
  );
  const initialParticipants = useMemo(() => {
    const linked = item.linked_task_assignees?.filter((participant) => participant.assignment_role !== "watcher").map((participant) => participant.user_id) ?? [];
    return Array.from(new Set(item.assignee_id ? [item.assignee_id, ...linked.filter((id) => id !== item.assignee_id)] : linked));
  }, [item.assignee_id, item.linked_task_assignees]);
  const initialDue = dateTimeParts(draftDueAt ?? item.due_at);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialParticipants);
  const [search, setSearch] = useState("");
  const [dueDate, setDueDate] = useState(initialDue.date);
  const [dueTime, setDueTime] = useState(initialDue.time);
  const [priority, setPriority] = useState<(typeof priorities)[number][0]>("normal");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const filteredPeople = people.filter((person) => person.fullName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const selectedPeople = selectedIds.map((id) => people.find((person) => person.id === id)).filter((person): person is AssignmentPerson => Boolean(person));

  const togglePerson = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  const submit = async () => {
    if (!selectedIds.length || !dueDate || !dueTime) {
      setError("Vui lòng chọn ít nhất một người và hạn hoàn thành.");
      return;
    }
    if (isDraft && !planId) {
      setError("Chưa có kỳ kế hoạch để giao việc.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = {
        assigneeIds: selectedIds,
        dueDate,
        dueTime,
        priority,
        note: note.trim() || null,
        title: item.title,
        description: item.description ?? item.title,
        requirements: requirementsFromItem(item.requirements),
      };
      const endpoint = isDraft
        ? `/api/planning/department/${planId}/items/assign`
        : `/api/planning/department/items/${item.id}/quick-assign`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as { task?: DepartmentPlanLinkedTask; item?: DepartmentPlanItemRow } | null;
      if (!response.ok || !payload?.task) {
        throw new Error(response.status === 403 ? "Bạn không có quyền giao công việc này." : response.status === 409 ? "Công việc này đã được giao." : "Không thể giao việc.");
      }
      onAssigned(payload.task, payload.item);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể giao việc.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="department-plan-quick-assign-title" className="w-full max-w-xl rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
      <header className="flex items-start justify-between gap-4 border-b border-orange-100 bg-orange-50 px-5 py-4 sm:px-6">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-orange-700">Giao việc nhanh</p><h2 id="department-plan-quick-assign-title" className="mt-1 text-xl font-extrabold text-slate-950">{item.title}</h2><p className="mt-1 text-sm text-slate-600">Một Task chuẩn sẽ được tạo và giao cho các người được chọn.</p></div>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Đóng" className="rounded-xl p-2 text-2xl leading-none text-slate-500 hover:bg-white">×</button>
      </header>
      <div className="grid gap-4 px-5 py-5 sm:px-6">
        <div className="grid gap-2 text-sm font-bold text-slate-700">
          <span>Người thực hiện</span>
          <label htmlFor="department-plan-assignee-search" className="font-normal text-slate-500">Tìm người</label>
          <input id="department-plan-assignee-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} disabled={busy} placeholder="Tìm theo tên nhân viên" className="h-11 rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
          <div className="flex min-h-11 flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2" aria-label="Người được chọn">
            {selectedPeople.map((person, index) => <span key={person.id} className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-800"><span>{person.fullName} · {index === 0 ? "Chính" : "Phối hợp"}</span><button type="button" onClick={() => togglePerson(person.id)} disabled={busy} aria-label={`Bỏ ${person.fullName}`} className="text-orange-600 hover:text-red-700">×</button></span>)}
            {!selectedPeople.length ? <span className="px-1 py-1 text-xs font-normal text-slate-500">Chưa chọn người.</span> : null}
          </div>
          <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1">
            {filteredPeople.map((person) => <label key={person.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 font-normal hover:bg-orange-50"><input type="checkbox" checked={selectedIds.includes(person.id)} onChange={() => togglePerson(person.id)} disabled={busy} /><span>{person.fullName}</span></label>)}
            {!filteredPeople.length ? <p className="px-3 py-3 text-sm font-normal text-slate-500">Không tìm thấy nhân sự phù hợp.</p> : null}
          </div>
          <p className="text-xs font-normal text-slate-500">Người đầu tiên là người chịu trách nhiệm chính; các chip tiếp theo là người phối hợp.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold text-slate-700">Hạn hoàn thành<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={busy} className="h-11 rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">Giờ<input type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} disabled={busy} className="h-11 rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label>
        </div>
        <label className="grid gap-1 text-sm font-bold text-slate-700">Mức độ ưu tiên<select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)} disabled={busy} className="h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100">{priorities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-bold text-slate-700">Ghi chú<textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} maxLength={2000} rows={3} placeholder="Không bắt buộc" className="rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label>
      </div>
      {error ? <p role="alert" className="mx-5 mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800 sm:mx-6">{error}</p> : null}
      <footer className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-4 sm:px-6"><button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Hủy</button><button type="button" onClick={() => void submit()} disabled={busy} className="min-h-11 rounded-xl bg-orange-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Đang giao…" : "Giao việc"}</button></footer>
    </div>
  </div>;
}
