"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";
import { responseErrorMessage, errorMessage } from "@/lib/actionFeedback";
import { normalizeTaskLink } from "@/lib/taskLinkPolicy.mjs";
import type { TaskLinkDto } from "@/lib/taskContracts";

export function TaskLinkIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0"><path d="M10 13a5 5 0 0 0 7 .2l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.2l-3 3a5 5 0 0 0 7 7l2-2M8 16l8-8" /></svg>;
}

export function taskLinkError(url: string) {
  if (!url.trim().startsWith("https://")) return "Link phải bắt đầu bằng https://";
  if (url.trim().length > 2048) return "Link không được dài quá 2048 ký tự.";
  return "Link không hợp lệ. Không dùng khoảng trắng hoặc thông tin đăng nhập trong link.";
}

export default function TaskLinkAttacher({ taskId, disabled = false, onAdded }: {
  taskId: string; disabled?: boolean; onAdded?: (link: TaskLinkDto) => void;
}) {
  const router = useRouter();
  const { notify } = useActionFeedback();
  const formId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  function close() { setOpen(false); setError(""); buttonRef.current?.focus(); }
  async function add() {
    if (disabled || pending.current) return;
    const input = normalizeTaskLink(url, title);
    if (!input) { setError(taskLinkError(url)); return; }
    pending.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/tasks/${taskId}/links`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      if (!response.ok) throw new Error(await responseErrorMessage(response, "Không thể thêm liên kết."));
      const body = await response.json() as { link: TaskLinkDto };
      onAdded?.(body.link); setUrl(""); setTitle(""); close();
      notify("success", "Đã thêm liên kết"); router.refresh();
    } catch (cause) { setError(errorMessage(cause, "Không thể thêm liên kết. Vui lòng thử lại.")); }
    finally { pending.current = false; setBusy(false); }
  }
  return <>
    <button ref={buttonRef} type="button" title="Thêm liên kết" aria-label="Thêm liên kết" aria-expanded={open} aria-controls={formId} disabled={disabled || busy} onClick={() => open ? close() : setOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-full border bg-white text-orange-700 hover:bg-orange-50 focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50"><TaskLinkIcon /></button>
    {open ? <div id={formId} role="group" aria-label="Thêm liên kết" className="grid w-full min-w-0 gap-3 rounded-xl border bg-slate-50 p-3" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } if (event.key === "Enter" && event.target instanceof HTMLInputElement) { event.preventDefault(); void add(); } }}>
      <label className="grid gap-1 text-sm font-semibold">Đường link (https://…)<input autoFocus type="url" value={url} disabled={disabled || busy} onChange={event => setUrl(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${formId}-error` : undefined} className="min-w-0 rounded-lg border bg-white px-3 py-2 font-normal focus:ring-2 focus:ring-orange-400" /></label>
      <label className="grid gap-1 text-sm font-semibold">Tên hiển thị (không bắt buộc)<input value={title} maxLength={200} disabled={disabled || busy} onChange={event => setTitle(event.target.value)} className="min-w-0 rounded-lg border bg-white px-3 py-2 font-normal focus:ring-2 focus:ring-orange-400" /></label>
      {error ? <p id={`${formId}-error`} role="alert" className="text-sm text-red-700">{error}</p> : null}
      <div className="flex flex-wrap gap-2"><button type="button" disabled={disabled || busy} onClick={() => void add()} className="min-h-11 rounded-lg bg-orange-700 px-4 py-2 text-sm font-semibold text-white focus-visible:ring-2 disabled:opacity-50">{busy ? "Đang thêm…" : "Thêm liên kết"}</button><button type="button" disabled={busy} onClick={close} className="min-h-11 rounded-lg border px-4 py-2 text-sm focus-visible:ring-2">Huỷ</button></div>
    </div> : null}
  </>;
}
