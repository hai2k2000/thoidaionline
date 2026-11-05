"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CollaboratorCandidate } from "@/lib/taskAssignmentRepository";
import { filterCollaboratorCandidates, collaboratorLabel } from "@/lib/taskCollaboratorPicker.mjs";
import { calculateParticipantPanelPosition } from "./participantPanelPosition.mjs";

export type ParticipantPanel = "collaborator" | "watcher";
const controlClass = "min-w-0 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400";

export default function ParticipantSelector({ label, name, people, selected, onChange, empty, panel, openPanel, setOpenPanel, disabled = false, compact = false }: {
  label: string;
  name: string;
  people: CollaboratorCandidate[];
  selected: string[];
  onChange: (ids: string[]) => void;
  empty: string;
  panel: ParticipantPanel;
  openPanel: ParticipantPanel | null;
  setOpenPanel: (panel: ParticipantPanel | null) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<ReturnType<typeof calculateParticipantPanelPosition> | null>(null);
  const [formId, setFormId] = useState<string>();
  const isOpen = openPanel === panel && !disabled;
  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    if (!form.id) form.id = `participant-form-${listId.replace(/:/g, "")}`;
    setFormId(form.id);
  }, [listId]);
  const selectedNames = selected.map((id) => people.find((person) => person.id === id)?.fullName).filter(Boolean);
  const summary = selectedNames.length === 0 ? `Chọn ${label.toLocaleLowerCase()}` : selectedNames.length <= 2 ? selectedNames.join(", ") : `${selectedNames.slice(0, 2).join(", ")} +${selectedNames.length - 2}`;
  const filteredPeople = panel === "collaborator" ? filterCollaboratorCandidates(people, search) : people.filter((person) => person.fullName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  useEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      let top = 0, bottom = window.innerHeight, left = 0, right = window.innerWidth;
      // Also close when a scrolling container clips the trigger out of view.
      for (let parent = trigger.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        const bounds = parent.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
      }
      if (trigger.matches(":disabled") || rect.bottom <= top || rect.top >= bottom || rect.right <= left || rect.left >= right) {
        setOpenPanel(null);
        return;
      }
      setPosition(calculateParticipantPanelPosition(rect, { viewportWidth: window.innerWidth, viewportHeight: window.innerHeight }));
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !panelRef.current?.contains(event.target as Node)) setOpenPanel(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpenPanel(null); triggerRef.current?.focus(); }
    };
    updatePosition();
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, setOpenPanel]);

  return <div ref={rootRef} className="grid min-w-0 self-start items-start gap-1 text-sm font-semibold">
    <span>{label}</span>
    <button ref={triggerRef} type="button" disabled={disabled} title={summary} aria-label={compact ? `${label}: ${summary}` : undefined} aria-expanded={isOpen} aria-controls={listId} aria-haspopup="listbox" onClick={() => { setSearch(""); setPosition(null); setOpenPanel(isOpen ? null : panel); }} className={`${controlClass} flex min-h-[46px] items-center justify-between gap-2 text-left`}>
      <span className={compact ? "min-w-0 whitespace-nowrap" : "min-w-0 truncate"}>{compact ? selected.length ? `${selected.length} người` : label : summary}</span><span aria-hidden="true">▾</span>
    </button>
    {isOpen && position ? createPortal(<div ref={panelRef} className="z-50 overflow-y-auto overflow-x-hidden rounded-lg border border-slate-300 bg-white text-sm shadow-lg" style={{ position: "fixed", left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight, transform: position.above ? "translateY(-100%)" : undefined }}>
      <div className="sticky top-0 z-10 bg-white p-2"><input ref={searchRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder={panel === "collaborator" ? "Tìm tên hoặc tài khoản" : "Tìm theo tên nhân viên"} aria-label={`Tìm ${label.toLocaleLowerCase()}`} className={controlClass} /></div>
      <div id={listId} role="listbox" aria-label={label} aria-multiselectable="true" className="space-y-0.5 p-2 pt-0">{filteredPeople.map((person) => <label key={person.id} role="option" aria-selected={selected.includes(person.id)} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 font-normal hover:bg-orange-50"><input form={formId} name={name} type="checkbox" value={person.id} checked={selected.includes(person.id)} onChange={(event) => onChange(event.target.checked ? [...new Set([...selected, person.id])] : selected.filter((id) => id !== person.id))} /><span className="min-w-0 break-words">{panel === "collaborator" ? collaboratorLabel(person) : person.fullName}</span></label>)}{filteredPeople.length === 0 ? <p className="px-2 py-3 font-normal text-slate-500">{search ? "Không tìm thấy nhân viên phù hợp." : empty}</p> : null}</div>
    </div>, document.body) : null}
  </div>;
}
