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
type PromptOptions = Omit<ConfirmOptions, "requireAcknowledge"> & { label: string; defaultValue?: string; type?: "text" | "date"; multiline?: boolean; required?: boolean };
type PromptPending = { options: PromptOptions; resolve: (value: string | null) => void; opener: HTMLElement | null };
type Pending = { options: ConfirmOptions; resolve: (value: boolean) => void; opener: HTMLElement | null };

const ConfirmContext = createContext<ConfirmContextValue | null>(null);
const PromptContext = createContext<((options: PromptOptions) => Promise<string | null>) | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [promptPending, setPromptPending] = useState<PromptPending | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const promptRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const finish = useCallback((result: boolean) => {
    if (!pending) return;
    pending.resolve(result);
    setPending(null);
    setAcknowledged(false);
    window.requestAnimationFrame(() => pending.opener?.focus());
  }, [pending]);

  const prompt = useCallback((options: PromptOptions) => new Promise<string | null>((resolve) => { setPromptPending({ options, resolve, opener: document.activeElement instanceof HTMLElement ? document.activeElement : null }); setPromptValue(options.defaultValue ?? ""); }), []);
  const finishPrompt = useCallback((value: string | null) => { if (!promptPending) return; promptPending.resolve(value); setPromptPending(null); window.requestAnimationFrame(() => promptPending.opener?.focus()); }, [promptPending]);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setPending({ options, resolve, opener: document.activeElement instanceof HTMLElement ? document.activeElement : null });
    setAcknowledged(false);
  }), []);

  useEffect(() => {
    if (!pending && !promptPending) return undefined;
    window.requestAnimationFrame(() => (promptPending ? promptRef.current?.focus() : cancelRef.current?.focus()));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); promptPending ? finishPrompt(null) : finish(false); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button, input, [href], select, textarea, [tabindex]:not([tabindex=\"-1\"])"));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pending, promptPending, finish, finishPrompt]);

  return <PromptContext.Provider value={prompt}><ConfirmContext.Provider value={{ confirm }}>
    {children}
    {promptPending ? <div className="mobile-dialog-overlay fixed inset-0 z-[120] grid place-items-center bg-slate-950/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) finishPrompt(null); }}><div ref={dialogRef} role="dialog" aria-modal="true" className="w-full max-w-lg rounded-[var(--radius-sheet)] border border-border bg-surface p-5 text-text shadow-2xl"><h2 className="text-lg font-bold text-brand-ink">{promptPending.options.title}</h2>{promptPending.options.message ? <p className="mt-3 text-sm text-text-muted">{promptPending.options.message}</p> : null}<label className="mt-4 grid gap-2 text-sm font-semibold">{promptPending.options.label}{promptPending.options.multiline ? <textarea ref={promptRef as React.RefObject<HTMLTextAreaElement>} value={promptValue} onChange={(event) => setPromptValue(event.target.value)} className="min-h-24 rounded border p-2 text-base font-normal" /> : <input ref={promptRef as React.RefObject<HTMLInputElement>} type={promptPending.options.type ?? "text"} value={promptValue} onChange={(event) => setPromptValue(event.target.value)} className="min-h-11 rounded border p-2 text-base font-normal" />}</label><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => finishPrompt(null)} className="min-h-11 rounded border px-4 py-2">{promptPending.options.cancelLabel ?? "Hủy"}</button><button type="button" disabled={Boolean(promptPending.options.required) && !promptValue.trim()} onClick={() => finishPrompt(promptValue)} className="min-h-11 rounded bg-brand px-4 py-2 text-white disabled:opacity-50">{promptPending.options.confirmLabel ?? "Xác nhận"}</button></div></div></div> : null}
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
  </ConfirmContext.Provider></PromptContext.Provider>;
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm must be used within ConfirmDialogProvider");
  return context.confirm;
}

export function usePromptDialog() { const context = useContext(PromptContext); if (!context) throw new Error("usePromptDialog must be used within ConfirmDialogProvider"); return context; }
