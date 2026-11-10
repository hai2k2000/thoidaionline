"use client";

import { useConfirm } from "@/components/ConfirmDialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";
import { TaskLinkIcon } from "@/components/TaskLinkAttacher";
import { responseErrorMessage, errorMessage } from "@/lib/actionFeedback";
import { normalizeTaskLink } from "@/lib/taskLinkPolicy.mjs";
import type { TaskLinkDto } from "@/lib/taskContracts";

export default function TaskLinkList({ taskId, links, actorId, admin = false, disabled = false }: {
  taskId: string; links: TaskLinkDto[]; actorId?: string; admin?: boolean; disabled?: boolean;
}) {
  const router = useRouter();
  const requestConfirmation = useConfirm();
  const { notify } = useActionFeedback();
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]);
  async function remove(link: TaskLinkDto) {
    if (busy || disabled) return;
    if (!await requestConfirmation({ title: "Xóa liên kết", message: `Xóa liên kết “${link.title}”?`, confirmLabel: "Xóa", tone: "danger" })) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}/links/${link.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseErrorMessage(response, "Không thể xóa liên kết."));
      setRemoved(current => [...current, link.id]); notify("success", "Đã xóa liên kết"); router.refresh();
    } catch (cause) { notify("error", errorMessage(cause, "Không thể xóa liên kết.")); }
    finally { setBusy(false); }
  }
  return <ul aria-label="Liên kết đính kèm" className="grid gap-2">{links.filter(link => !removed.includes(link.id)).map(link => {
    const safe = normalizeTaskLink(link.url, link.title);
    if (!safe) return null;
    return <li key={link.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 p-3">
      <TaskLinkIcon /><div className="min-w-0 flex-1"><a href={safe.url} target="_blank" rel="noopener noreferrer" className="break-words font-semibold text-orange-700 underline focus-visible:ring-2">{link.title}</a><p className="break-all text-xs text-slate-500">{new URL(safe.url).hostname}</p></div>
      {admin || link.created_by === actorId ? <button type="button" aria-label={`Xóa liên kết ${link.title}`} disabled={disabled || busy} onClick={() => void remove(link)} className="min-h-11 shrink-0 rounded-lg border border-red-200 px-3 text-sm text-red-700 focus-visible:ring-2 disabled:opacity-50">Xóa</button> : null}
    </li>;
  })}</ul>;
}
