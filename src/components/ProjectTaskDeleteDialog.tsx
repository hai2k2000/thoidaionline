"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ProjectTask } from "@/lib/projectRepository";

const button = "min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50";

export default function ProjectTaskDeleteDialog({ tasks, busy, error, onCancel, onConfirm }: { tasks: ProjectTask[]; busy: boolean; error: string; onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId(); const descriptionId = useId();
  const [trigger] = useState(() => typeof document === "undefined" ? null : document.activeElement as HTMLElement | null);
  useEffect(() => { dialog.current?.showModal(); cancel.current?.focus(); return () => { trigger?.focus(); }; }, [trigger]);
  return <dialog ref={dialog} aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={busy} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }} className="mobile-native-sheet fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-900/50 sm:p-6">
    <h2 id={titleId} className="text-lg font-bold">Xóa vĩnh viễn {tasks.length} công việc?</h2>
    <p id={descriptionId} className="mt-3 text-sm leading-6">Thao tác này xóa vĩnh viễn công việc, trao đổi, tiến độ và tệp đính kèm. Không thể khôi phục.</p>
    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{tasks.slice(0, 10).map(task => <li key={task.id} className="break-words">{task.title}</li>)}{tasks.length > 10 ? <li>và {tasks.length - 10} việc khác</li> : null}</ul>
    {error ? <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : null}
    <div className="mt-5 flex flex-wrap justify-end gap-2"><button ref={cancel} type="button" disabled={busy} onClick={onCancel} className={button}>Hủy</button><button type="button" disabled={busy} onClick={onConfirm} className={`${button} border-rose-600 bg-rose-600 text-white`}>{busy ? "Đang xóa…" : "Xóa vĩnh viễn"}</button></div>
  </dialog>;
}
