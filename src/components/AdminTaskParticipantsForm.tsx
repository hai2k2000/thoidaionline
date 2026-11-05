"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { TaskDetailDto } from "@/lib/taskContracts";
import ParticipantSelector, { type ParticipantPanel } from "@/components/ParticipantSelector";
import { errorMessage, responseErrorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";
import type { CollaboratorCandidate } from "@/lib/taskAssignmentRepository";

type Props = { task: TaskDetailDto; people: CollaboratorCandidate[]; reviewers: CollaboratorCandidate[] };
export default function AdminTaskParticipantsForm({ task, people, reviewers }: Props) {
  const router = useRouter();
  const { notify } = useActionFeedback();
  const [assignee, setAssignee] = useState(task.assignee_id ?? task.owner_id ?? "");
  const [collaborators, setCollaborators] = useState(task.task_assignees.filter(p => p.assignment_role === "assignee").map(p => p.user_id));
  const [watchers, setWatchers] = useState(task.task_assignees.filter(p => p.assignment_role === "watcher").map(p => p.user_id));
  const [reviewer, setReviewer] = useState(task.reviewer_id ?? "");
  const [open, setOpen] = useState<ParticipantPanel | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/tasks/${task.id}/admin-participants`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ assigneeId: assignee, collaboratorIds: collaborators, watcherIds: watchers, reviewerId: reviewer || null, reason: String(form.get("reason") ?? "") }),
      });
      if (!response.ok) throw new Error(await responseErrorMessage(response, "Không thể cập nhật người tham gia."));
      notify("success", "Đã cập nhật người tham gia."); router.refresh();
    } catch (cause) {
      const message = errorMessage(cause, "Không thể cập nhật người tham gia.");
      setError(message); notify("error", message);
    } finally { setBusy(false); }
  };
  const control = "mt-1 w-full rounded-lg border px-3 py-2";
  return <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm">
    <h2 className="text-lg font-bold">Người tham gia</h2>
    <label className="text-sm font-semibold">Người nhận việc
      <select value={assignee} onChange={event => { const id = event.target.value; setAssignee(id); setCollaborators(ids => ids.filter(value => value !== id)); setWatchers(ids => ids.filter(value => value !== id)); }} required disabled={busy} className={control}>
        <option value="">Chọn người nhận việc</option>
        {assignee && !people.some(p => p.id === assignee) ? <option value={assignee} disabled>Người nhận hiện tại không còn đủ điều kiện</option> : null}
        {people.map(person => <option key={person.id} value={person.id}>{person.fullName}</option>)}
      </select>
    </label>
    <div className="grid gap-3 sm:grid-cols-2">
      <ParticipantSelector label="Người phối hợp" name="collaboratorIds" people={people.filter(p => p.id !== assignee && !watchers.includes(p.id))} selected={collaborators} onChange={setCollaborators} empty="Không có người phù hợp" panel="collaborator" openPanel={open} setOpenPanel={setOpen} disabled={busy}/>
      <ParticipantSelector label="Người theo dõi" name="watcherIds" people={people.filter(p => p.id !== assignee && !collaborators.includes(p.id))} selected={watchers} onChange={setWatchers} empty="Không có người phù hợp" panel="watcher" openPanel={open} setOpenPanel={setOpen} disabled={busy}/>
    </div>
    <label className="text-sm font-semibold">Người duyệt
      <select value={reviewer} onChange={event => setReviewer(event.target.value)} required={Boolean(task.project_id)} disabled={busy} className={control}>
        <option value="">{task.project_id ? "Chọn trưởng dự án hoặc quản trị viên" : "Không có người duyệt"}</option>
        {reviewer && !reviewers.some(p => p.id === reviewer) ? <option value={reviewer} disabled>Người duyệt hiện tại không còn đủ điều kiện</option> : null}
        {reviewers.map(person => <option key={person.id} value={person.id}>{person.fullName}</option>)}
      </select>
    </label>
    <label className="text-sm font-semibold">Lý do cập nhật<input name="reason" required maxLength={2000} disabled={busy} className={control}/></label>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    <button disabled={busy} className="w-fit rounded-lg bg-orange-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Đang lưu…" : "Lưu người tham gia"}</button>
  </form>;
}
