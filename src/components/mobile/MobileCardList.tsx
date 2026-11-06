import Link from "next/link";
import { Children, type ReactNode } from "react";

export type MobileCardBadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";
export type MobileCardMeta = { label: string; value: ReactNode };

const badgeToneClasses: Record<MobileCardBadgeTone, string> = {
  neutral: "border-border bg-surface-muted text-text-muted",
  success: "border-success bg-success-soft text-success",
  warning: "border-warning bg-warning-soft text-warning",
  danger: "border-danger bg-danger-soft text-danger",
  info: "border-info bg-info-soft text-info",
  brand: "border-brand bg-brand text-surface",
};

export function MobileCardBadge({ tone = "neutral", children }: { tone?: MobileCardBadgeTone; children: ReactNode }) {
  return <span className={`inline-flex min-h-6 max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-semibold [overflow-wrap:anywhere] ${badgeToneClasses[tone]}`}>{children}</span>;
}

export function MobileCard({
  title,
  status,
  meta = [],
  footer,
  href,
  children,
}: {
  title: ReactNode;
  status?: ReactNode;
  meta?: MobileCardMeta[];
  footer?: ReactNode;
  href?: string;
  children?: ReactNode;
}) {
  const content = <>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h3 className="min-w-0 break-words text-base font-semibold text-brand-ink">{title}</h3>
      {status ? <div className="max-w-full">{status}</div> : null}
    </div>
    {meta.length ? <dl className="mt-3 grid gap-2">{meta.slice(0, 4).map((item) => <div key={item.label} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3"><dt className="text-xs text-text-muted">{item.label}</dt><dd className="min-w-0 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{item.value}</dd></div>)}</dl> : null}
    {children}
    {footer && !href ? <footer className="mt-3 flex flex-wrap gap-2">{footer}</footer> : null}
  </>;
  return <li className="min-w-0 rounded-[var(--radius-card)] border border-border bg-surface text-text shadow-sm"><article>{href ? <Link href={href} className="block min-h-11 rounded-[var(--radius-card)] p-4 outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">{content}</Link> : <div className="p-4">{content}</div>}</article></li>;
}

export function MobileCardList({ children, empty = "Chưa có dữ liệu", ariaLabel = "Danh sách" }: { children?: ReactNode; empty?: ReactNode; ariaLabel?: string }) {
  return <ul aria-label={ariaLabel} className="grid min-w-0 list-none gap-3 md:hidden print:hidden">{Children.toArray(children).length ? children : <li className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface-muted p-6 text-center text-sm text-text-muted">{empty}</li>}</ul>;
}

export default MobileCardList;
