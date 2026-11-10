"use client";

import { useState } from "react";
import { normalizeTaskLink } from "@/lib/taskLinkPolicy.mjs";
import type { TaskLinkInput } from "@/lib/taskLinkPolicy";
import { TaskLinkIcon, taskLinkError } from "@/components/TaskLinkAttacher";

export default function TaskLinkDraftFields({ links, onChange, disabled = false }: {
  links: TaskLinkInput[]; onChange: (links: TaskLinkInput[]) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  function add() {
    if (disabled || links.length >= 5) return;
    const link = normalizeTaskLink(url, title);
    if (!link) { setError(taskLinkError(url)); return; }
    onChange([...links, link]); setUrl(""); setTitle(""); setError(""); setOpen(false);
  }
  return <div className="grid min-w-0 gap-2 text-sm">
    <button type="button" disabled={disabled || links.length >= 5} aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-11 items-center gap-2 justify-self-start rounded-lg border px-3 text-orange-700 focus-visible:ring-2 disabled:opacity-50"><TaskLinkIcon />Thêm liên kết ({links.length}/5)</button>
    {links.length ? <ul className="grid gap-2">{links.map((link, index) => <li key={index} className="flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1 break-words">{link.title}</span><button type="button" disabled={disabled} onClick={() => onChange(links.filter((_, position) => index !== position))} aria-label={`Xóa liên kết ${link.title}`} className="min-h-11 rounded px-3 text-red-700 focus-visible:ring-2">Xóa</button></li>)}</ul> : null}
    {open ? <div role="group" aria-label="Liên kết cho công việc mới" className="grid min-w-0 gap-2 rounded-lg border bg-white p-3" onKeyDown={event => { if (event.key === "Enter" && event.target instanceof HTMLInputElement) { event.preventDefault(); add(); } if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); } }}>
      <label className="grid gap-1">Đường link (https://…)<input type="url" value={url} disabled={disabled} onChange={event => setUrl(event.target.value)} className="min-w-0 rounded border px-3 py-2 focus:ring-2" /></label>
      <label className="grid gap-1">Tên hiển thị (không bắt buộc)<input value={title} maxLength={200} disabled={disabled} onChange={event => setTitle(event.target.value)} className="min-w-0 rounded border px-3 py-2 focus:ring-2" /></label>
      {error ? <p role="alert" className="text-red-700">{error}</p> : null}
      <div className="flex gap-2"><button type="button" disabled={disabled} onClick={add} className="min-h-11 rounded bg-orange-700 px-3 text-white focus-visible:ring-2">Thêm liên kết</button><button type="button" onClick={() => { setOpen(false); setError(""); }} className="min-h-11 rounded border px-3 focus-visible:ring-2">Huỷ</button></div>
    </div> : null}
  </div>;
}
