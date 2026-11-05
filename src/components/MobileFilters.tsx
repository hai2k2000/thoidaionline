"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

const subscribe = (listener: () => void) => {
  const media = window.matchMedia("(max-width: 1023px)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};
const snapshot = () => window.matchMedia("(max-width: 1023px)").matches;

/** One set of controls: inline on desktop and a modal filter sheet on phones. */
export default function MobileFilters({ children, label = "Bộ lọc" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const mobile = useSyncExternalStore(subscribe, snapshot, () => false);
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open || !mobile) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      // A child popover owns focus and Escape while it is open in a portal.
      if (document.querySelector('[data-filter-popover]')) return;
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
      if (event.key !== "Tab") return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([type="hidden"]),select,textarea,summary') ?? []).filter((node) => node.getClientRects().length);
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); };
  }, [open, mobile]);
  return <div className="mobile-filters">
    <button ref={trigger} type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls={id} className="mobile-filter-trigger lg:hidden"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 5h18l-7 8v6l-4 2v-8Z" /></svg>{label}</button>
    {open && mobile ? <button type="button" aria-label="Đóng bộ lọc" onClick={close} className="mobile-filter-backdrop" style={{ position: "fixed" }} /> : null}
    <div ref={panel} id={id} className="mobile-filter-panel" data-open={open} role={open && mobile ? "dialog" : undefined} aria-modal={open && mobile ? true : undefined} aria-label={label} style={open && mobile ? { position: "fixed" } : undefined}>
      <header className="mobile-filter-heading"><h2>{label}</h2><button type="button" onClick={close} aria-label="Đóng bộ lọc">Đóng</button></header>
      <div className="mobile-filter-body">{children}</div>
      <footer className="mobile-filter-footer"><button type="button" onClick={close}>Xem kết quả</button></footer>
    </div>
  </div>;
}
