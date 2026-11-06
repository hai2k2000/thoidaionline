"use client";

import { useCallback, useEffect, useRef, useState, createContext, useContext, type ReactNode } from "react";

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  requireAcknowledge?: string;
};

type ConfirmContextValue = { confirm: (options: ConfirmOptions) => Promise<boolean> };
type Pending = { options: ConfirmOptions; resolve: (value: boolean) => void; opener: HTMLElement | null };

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const finish = useCallback((result: boolean) => {
    if (!pending) return;
    pending.resolve(result);
    setPending(null);
    setAcknowledged(false);
    window.requestAnimationFrame(() => pending.opener?.focus());
  }, [pending]);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setPending({ options, resolve, opener: document.activeElement instanceof HTMLElement ? document.activeElement : null });
    setAcknowledged(false);
  }), []);

  useEffect(() => {
    if (!pending) return undefined;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); finish(false); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button, input, [href], select, textarea, [tabindex]:not([tabindex=\"-1\"])"));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pending, finish]);

  return <ConfirmContext.Provider value={{ confirm }}>
    {children}
    {pending ? <div className="mobile-dialog-overlay fixed inset-0 z-[120] grid place-items-center bg-slate-950/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) finish(false); }}>
      <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby={pending.options.message ? "confirm-dialog-message" : undefined} className="w-full max-w-lg rounded-[var(--radius-sheet)] border border-border bg-surface p-5 text-text shadow-2xl sm:p-6">
        <h2 id="confirm-dialog-title" className="whitespace-pre-line text-lg font-bold text-brand-ink">{pending.options.title}</h2>
        {pending.options.message ? <p id="confirm-dialog-message" className="mt-3 whitespace-pre-line text-sm text-text-muted">{pending.options.message}</p> : null}
        {pending.options.requireAcknowledge ? <label className="mt-4 flex min-h-11 items-start gap-3 text-sm font-semibold"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-danger" /> <span>{pending.options.requireAcknowledge}</span></label> : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" onClick={() => finish(false)} className="min-h-11 rounded-[var(--radius-control)] border border-border px-4 py-2 text-sm font-semibold text-text">{pending.options.cancelLabel ?? "Hủy"}</button>
          <button type="button" disabled={Boolean(pending.options.requireAcknowledge) && !acknowledged} onClick={() => finish(true)} className={`min-h-11 rounded-[var(--radius-control)] px-4 py-2 text-sm font-semibold text-white ${pending.options.tone === "danger" ? "bg-danger" : "bg-brand"} disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-32`}>{pending.options.confirmLabel ?? "Xác nhận"}</button>
        </div>
      </div>
    </div> : null}
  </ConfirmContext.Provider>;
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm must be used within ConfirmDialogProvider");
  return context.confirm;
}
