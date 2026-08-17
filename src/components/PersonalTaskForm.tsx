"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type InitialTask = {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  dueDate: string;
  evaluationCriteria: string | null;
};

type Props = { initialTask?: InitialTask };

export default function PersonalTaskForm({ initialTask }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editing = Boolean(initialTask);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const startDate = String(form.get("startDate") ?? "");
    const dueDate = String(form.get("dueDate") ?? "");
    const evaluationCriteria = String(form.get("evaluationCriteria") ?? "").trim();
    const deadlineReason = String(form.get("deadlineReason") ?? "").trim();
    if (!title || !description || !startDate || !dueDate || startDate > dueDate) {
      setError("Vui lòng nhập đủ thông tin và bảo đảm ngày bắt đầu không sau deadline.");
      return;
    }
    if (editing && dueDate !== initialTask?.dueDate && !deadlineReason) {
      setError("Cần nhập lý do khi thay đổi deadline.");
      return;
    }
    setBusy(true);
    setError("");
    const body = { title, description, startDate, dueDate, evaluationCriteria };
    const response = await fetch(
      editing ? `/api/tasks/${initialTask?.id}/personal` : "/api/tasks/personal",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    ).catch(() => null);
    if (!response?.ok) {
      setBusy(false);
      setError("Không thể lưu nhiệm vụ cá nhân.");
      return;
    }
    if (editing && dueDate !== initialTask?.dueDate) {
      const deadline = await fetch(`/api/tasks/${initialTask?.id}/deadline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate, reason: deadlineReason }),
      }).catch(() => null);
      if (!deadline?.ok) {
        setBusy(false);
        setError("Nội dung đã lưu nhưng chưa đổi được deadline. Vui lòng thử lại.");
        return;
      }
    }
    router.push("/tasks?scope=personal");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
      <div>
        <label htmlFor="title" className="text-sm font-semibold">Tên nhiệm vụ</label>
        <input id="title" name="title" required maxLength={500} defaultValue={initialTask?.title} className="mt-1 w-full rounded-lg border px-3 py-2" />
      </div>
      <div>
        <label htmlFor="description" className="text-sm font-semibold">Nội dung</label>
        <textarea id="description" name="description" required maxLength={10000} defaultValue={initialTask?.description ?? ""} className="mt-1 min-h-32 w-full rounded-lg border px-3 py-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="startDate" className="text-sm font-semibold">Ngày bắt đầu</label>
          <input id="startDate" name="startDate" type="date" required defaultValue={initialTask?.startDate} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </div>
        <div>
          <label htmlFor="dueDate" className="text-sm font-semibold">Deadline</label>
          <input id="dueDate" name="dueDate" type="date" required defaultValue={initialTask?.dueDate} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </div>
      </div>
      {editing ? (
        <div>
          <label htmlFor="deadlineReason" className="text-sm font-semibold">Lý do đổi deadline</label>
          <input id="deadlineReason" name="deadlineReason" maxLength={2000} className="mt-1 w-full rounded-lg border px-3 py-2" />
          <p className="mt-1 text-xs text-slate-500">Bắt buộc nếu deadline thay đổi.</p>
        </div>
      ) : null}
      <div>
        <label htmlFor="evaluationCriteria" className="text-sm font-semibold">Tiêu chí hoàn thành</label>
        <textarea id="evaluationCriteria" name="evaluationCriteria" maxLength={10000} defaultValue={initialTask?.evaluationCriteria ?? ""} className="mt-1 min-h-24 w-full rounded-lg border px-3 py-2" />
      </div>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button disabled={busy} className="rounded-lg bg-orange-500 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {busy ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo nhiệm vụ"}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-lg border px-4 py-2 font-semibold">Hủy</button>
      </div>
    </form>
  );
}