"use client";

import type { ReactNode } from "react";

export function LoadingState({ label = "Đang tải…" }: { label?: string }) {
  return <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-text-muted"><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-brand" />{label}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface-muted p-6 text-center"><h2 className="text-base font-bold text-brand-ink">{title}</h2>{description ? <p className="mt-1 text-sm text-text-muted">{description}</p> : null}{action ? <div className="mt-4">{action}</div> : null}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="rounded-[var(--radius-card)] border border-danger/30 bg-danger-soft p-4 text-sm text-danger"><p>{message}</p>{onRetry ? <button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-[var(--radius-control)] border border-danger px-4 py-2 font-semibold">Thử lại</button> : null}</div>;
}
