"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export default function TaskFilterPopover({ label, summary, triggerText, count = 0, children }: {
  label: string; summary?: string; triggerText?: ReactNode; count?: number; children: ReactNode;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number; width: number; maxHeight: number; above: boolean } | null>(null);
  const open = position !== null;
  const place = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(340, window.innerWidth - 16);
    const below = window.innerHeight - rect.bottom - 12;
    const above = below < 320 && rect.top > below;
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: above ? rect.top - 4 : rect.bottom + 4, width, maxHeight: Math.max(0, above ? rect.top - 12 : below), above });
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) setPosition(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setPosition(null); trigger.current?.focus(); }
    };
    const focusOutside = (event: FocusEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) setPosition(null);
    };
    panel.current?.querySelector<HTMLElement>("input, select, button")?.focus();
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    document.addEventListener("focusin", focusOutside);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("focusin", focusOutside);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  return <>
    <button ref={trigger} type="button" aria-label={summary && summary !== label ? `${label}: ${summary}` : label} title={summary || label} aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="dialog" onClick={() => open ? setPosition(null) : place()} className="flex h-11 w-full min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg border px-1 text-xs">
      {triggerText ?? label}{count > 0 ? <span className="rounded-full bg-orange-500 px-1.5 text-white" aria-label={`${count} bộ lọc đang chọn`}>{count}</span> : null}<span aria-hidden="true">▾</span>
    </button>
    {position ? createPortal(<div ref={panel} id={id} role="dialog" aria-label={label} className="z-50 grid gap-3 overflow-y-auto rounded-xl border bg-white p-4 text-sm shadow-xl" style={{ position: "fixed", left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight, transform: position.above ? "translateY(-100%)" : undefined }}>
      {summary ? <p className="text-xs text-slate-600">{summary}</p> : null}
      {children}
      <button type="button" className="justify-self-end rounded border px-3 py-2" onClick={() => { setPosition(null); trigger.current?.focus(); }}>Đóng</button>
    </div>, document.body) : null}
  </>;
}
