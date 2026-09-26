"use client";

import { useEffect, useMemo, useState } from "react";
import CanonicalAssignmentForm, { type CanonicalAssignmentSubmit } from "@/components/CanonicalAssignmentForm";
import type { AssignmentDepartment, AssignmentPerson, AssignmentScope } from "@/lib/taskAssignmentRepository";
import type { DepartmentPlanItemRow, DepartmentPlanLinkedTask } from "@/lib/departmentPlanRepository";

type Props = {
  item: DepartmentPlanItemRow;
  departmentName: string;
  departmentCode?: string | null;
  departmentManagerId: string | null;
  scopeKind: "own_department" | "global";
  assignmentDepartments: AssignmentDepartment[];
  assignmentPeople: AssignmentPerson[];
  assignmentScope: AssignmentScope;
  onClose: () => void;
  onAssigned: (task: DepartmentPlanLinkedTask) => void;
};

const dueParts = (value: string | null) => {
  if (!value) return { dueDate: "", dueTime: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { dueDate: "", dueTime: "" };
  return { dueDate: date.toISOString().slice(0, 10), dueTime: date.toISOString().slice(11, 16) };
};

const requirementsFromItem = (value: string | null) => {
  if (!value?.trim()) return [""];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const values = parsed.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean);
      if (values.length) return values;
    }
  } catch { /* Plain-text plan requirements are the normal format. */ }
  return value.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean).slice(0, 50);
};

export default function DepartmentPlanAssignmentDialog({ item, departmentName, departmentCode, departmentManagerId, scopeKind, assignmentDepartments, assignmentPeople, assignmentScope, onClose, onAssigned }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [authoritativeItem, setAuthoritativeItem] = useState(item);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void fetch(`/api/planning/department/items/${item.id}`).then((response) => response.ok ? response.json() as Promise<{ item: DepartmentPlanItemRow; linkedTask: DepartmentPlanLinkedTask | null }> : Promise.reject(new Error("Không thể tải mục kế hoạch."))).then((payload) => { if (active) { setAuthoritativeItem(payload.item); if (payload.linkedTask) setError("Mục kế hoạch đã được giao. Hãy mở công việc hiện có."); setLoading(false); } }).catch((reason: unknown) => { if (active) { setError(reason instanceof Error ? reason.message : "Không thể tải mục kế hoạch."); setLoading(false); } });
    return () => { active = false; };
  }, [item.id]);
  const department = useMemo<AssignmentDepartment>(() => assignmentDepartments.find((candidate) => candidate.id === authoritativeItem.department_id) ?? ({
    id: authoritativeItem.department_id,
    code: departmentCode ?? null,
    name: departmentName,
    managerId: departmentManagerId,
    hasManager: Boolean(departmentManagerId),
  }), [assignmentDepartments, authoritativeItem.department_id, departmentCode, departmentManagerId, departmentName]);
  const people = useMemo<AssignmentPerson[]>(() => assignmentPeople.filter((person) => person.departmentId === authoritativeItem.department_id), [assignmentPeople, authoritativeItem.department_id]);
  const canonicalScope = useMemo<AssignmentScope>(() => ({
    ...assignmentScope,
    kind: scopeKind === "own_department" ? "own_department" : "global_default",
    departmentId: authoritativeItem.department_id,
    departmentName,
    canChooseOtherDepartment: false,
  }), [assignmentScope, authoritativeItem.department_id, departmentName, scopeKind]);
  const initialDue = dueParts(authoritativeItem.due_at);
  const initialValues = {
    departmentId: authoritativeItem.department_id,
    assigneeId: authoritativeItem.assignment_state === "assigned" ? authoritativeItem.assignee_id ?? "" : "",
    title: authoritativeItem.title,
    description: authoritativeItem.description ?? "",
    requirements: requirementsFromItem(authoritativeItem.requirements),
    dueDate: initialDue.dueDate,
    dueTime: initialDue.dueTime,
    priority: "normal" as const,
    recurrenceFrequency: null,
    recurrenceEndsOn: null,
  };

  const submit = async (value: CanonicalAssignmentSubmit) => {
    const card = value.cards[0];
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/planning/department/items/${item.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: card.title,
          description: card.description,
          requirements: card.requirements,
          assigneeId: value.assigneeId,
          dueDate: card.dueDate,
          dueTime: card.dueTime,
          priority: card.priority,
          collaboratorIds: card.collaboratorIds,
          watcherIds: card.watcherIds,
          recurrenceFrequency: null,
          recurrenceEndsOn: null,
        }),
      });
      const payload = await response.json().catch(() => null) as { task?: DepartmentPlanLinkedTask } | null;
      if (!response.ok || !payload?.task) {
        throw new Error(response.status === 403 ? "Bạn không có quyền giao công việc này." : response.status === 409 ? "Mục kế hoạch đã được giao. Hãy mở công việc hiện có." : "Không thể giao công việc.");
      }
      onAssigned(payload.task);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể giao công việc.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="department-plan-assignment-title" className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-slate-50 shadow-2xl sm:max-h-[92vh] sm:rounded-3xl">
      <header className="flex items-start justify-between gap-4 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-4 sm:px-6"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-orange-700">Giao việc từ kế hoạch phòng</p><h2 id="department-plan-assignment-title" className="mt-1 text-xl font-extrabold text-slate-950">XÁC NHẬN CÔNG VIỆC</h2><p className="mt-1 text-sm text-slate-600">Dữ liệu dưới đây được lấy từ mục kế hoạch đã lưu; chỉnh sửa chỉ áp dụng cho Task mới.</p></div><button type="button" onClick={onClose} disabled={busy} aria-label="Đóng" className="rounded-xl p-2 text-2xl leading-none text-slate-500 hover:bg-white hover:text-slate-900">×</button></header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">{loading ? <p className="py-12 text-center text-sm text-slate-600">Đang tải dữ liệu đã lưu…</p> : <CanonicalAssignmentForm departments={[department]} people={people} assignmentScope={canonicalScope} initialValues={initialValues} onSubmit={submit} onCancel={onClose} submitLabel="Giao việc" disabled={busy} singleTaskOnly disableAttachments />}</div>
      {error ? <p role="alert" className="mx-4 mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:mx-6">{error}</p> : null}
    </div>
  </div>;
}
