"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type NotificationItem = {
  key: string;
  kind: "assignment" | "deadline" | "comment" | "status" | "deadline_change";
  title: string;
  message: string;
  href: string;
  createdAt: string;
  unread: boolean;
};

const kindClass: Record<NotificationItem["kind"], string> = {
  assignment: "bg-sky-100 text-sky-700",
  deadline: "bg-red-100 text-red-700",
  comment: "bg-amber-100 text-amber-700",
  status: "bg-emerald-100 text-emerald-700",
  deadline_change: "bg-orange-100 text-orange-700",
};

const timeText = (value: string) => new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short",
}).format(new Date(value));

export default function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return setLoading(false);
    const payload = await response.json() as { items?: NotificationItem[]; unreadCount?: number };
    setItems(payload.items ?? []);
    setUnreadCount(payload.unreadCount ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(load, 60000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [load]);

  const mark = async (keys: string[]) => {
    if (!keys.length) return;
    setItems((current) => current.map((item) => keys.includes(item.key) ? { ...item, unread: false } : item));
    setUnreadCount((count) => Math.max(0, count - keys.filter((key) => items.some((item) => item.key === key && item.unread)).length));
    await fetch("/api/notifications", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ keys }),
    }).catch(() => null);
  };

  const unreadKeys = items.filter((item) => item.unread).map((item) => item.key);
  return <details className="group relative z-30 text-left">
    <summary aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ""}`} className="relative grid size-10 cursor-pointer list-none place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-orange-300 hover:text-orange-700 [&::-webkit-details-marker]:hidden">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
      {unreadCount ? <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
    </summary>
    <div className="absolute right-0 mt-2 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b px-4 py-3"><div><p className="font-bold text-slate-900">Thông báo</p><p className="text-xs text-slate-500">{unreadCount} chưa đọc</p></div>{unreadCount ? <button type="button" onClick={() => void mark(unreadKeys)} className="text-xs font-semibold text-orange-700 hover:underline">Đánh dấu tất cả đã đọc</button> : null}</div>
      <div className="max-h-[420px] overflow-y-auto">
        {loading ? <p className="p-6 text-center text-sm text-slate-500">Đang tải thông báo…</p> : null}
        {!loading && !items.length ? <p className="p-6 text-center text-sm text-slate-500">Chưa có thông báo.</p> : null}
        {items.map((item) => <Link key={item.key} href={item.href} onClick={() => item.unread && void mark([item.key])} className={`block border-b px-4 py-3 transition hover:bg-orange-50 ${item.unread ? "bg-orange-50/60" : "bg-white"}`}>
          <div className="flex gap-3"><span className={`mt-1 size-2.5 shrink-0 rounded-full ${kindClass[item.kind]}`} /><div className="min-w-0"><p className={`text-sm ${item.unread ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>{item.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{item.message}</p><p className="mt-1 text-[11px] text-slate-400">{timeText(item.createdAt)}</p></div></div>
        </Link>)}
      </div>
    </div>
  </details>;
}
