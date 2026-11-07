"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppNav from "@/components/AppNav";
import { deskCopy } from "@/lib/deskHomeCopy.mjs";
import { announcementCopy } from "@/lib/announcementLibraryCopy.mjs";
import { selectDeskNotifications } from "@/lib/deskHome.mjs";
import type { DeskApprovalItem, DeskData, DeskScheduleItem, DeskTodayItem } from "@/lib/deskRepository";

type NotificationItem = { key: string; kind: string; title: string; message: string; href: string; createdAt: string; unread: boolean };
type Props = { fullName: string; avatarUrl?: string | null; greeting: string; dateLabel: string; data: DeskData };
type Block<T> = { ok: true; value: T } | { ok: false } | null;

function blockValue<T>(block: Block<T>) { return block?.ok ? block.value : null; }
const listRowClass = "min-h-11 min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-3 hover:border-orange-300 lg:min-h-0";
const rowVisibility = (index: number) => index < 3 ? "flex" : "hidden lg:flex";

function Card({ id, title, href, children }: { id: string; title: string; href?: string; children: React.ReactNode }) {
  return <section id={id} aria-labelledby={id + "-title"} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between"><h2 id={id + "-title"} className="text-lg font-bold">{title}</h2>{href ? <Link href={href} className="text-sm font-semibold text-orange-700">{deskCopy.all}</Link> : null}</div>
    {children}
  </section>;
}

function Failure({ name }: { name: string }) { return <p className="text-sm text-red-700">{deskCopy.loadFailed.replace("{name}", name)}</p>; }
function TodayList({ items }: { items: DeskTodayItem[] }) { return <div className="space-y-2">{items.length ? items.slice(0, 5).map((item, index) => <Link key={item.id} href={item.href} className={`${rowVisibility(index)} ${listRowClass}`}><span className="min-w-0 flex-1 line-clamp-2 font-semibold">{item.title}</span><span className={`shrink-0 text-xs ${item.state === "overdue" ? "text-red-700" : item.state === "today" ? "text-amber-700" : "text-slate-500"}`}>{item.label}</span></Link>) : <p className="text-sm text-slate-500">{deskCopy.emptyToday}</p>}</div>; }
function ApprovalList({ items }: { items: DeskApprovalItem[] }) { return <div className="space-y-2">{items.length ? items.slice(0, 5).map((item, index) => <Link key={item.id} href={item.href} className={`${rowVisibility(index)} ${listRowClass}`}><span className="min-w-0 flex-1"><span className="line-clamp-2 font-semibold">{item.title}</span><span className="block text-xs text-slate-500">{item.subtitle}</span></span><span className="shrink-0 text-xs font-semibold text-orange-700">{item.action}</span></Link>) : <p className="text-sm text-slate-500">{deskCopy.emptyApprovals}</p>}</div>; }
function ScheduleList({ rows }: { rows: DeskScheduleItem[] }) { return <div className="space-y-2">{rows.slice(0, 5).map((item, index) => <div key={item.id} className={`${rowVisibility(index)} ${listRowClass}`}><span className="shrink-0 text-xs text-slate-500">{item.time}</span><span className="min-w-0 flex-1 line-clamp-2 font-semibold">{item.title}</span>{item.pending ? <span className="shrink-0 text-xs font-semibold text-orange-700">{deskCopy.schedulePending}</span> : null}{item.location ? <span className="shrink-0 text-xs text-slate-500">{item.location}</span> : null}</div>)}</div>; }

export default function DeskHome({ fullName, avatarUrl, greeting, dateLabel, data }: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsFailed, setNotificationsFailed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    const handleNotifications = (event: Event) => {
      const detail = (event as CustomEvent<{ items: NotificationItem[]; unreadCount: number; failed: boolean }>).detail;
      setNotificationsLoading(false); setNotificationsFailed(detail.failed);
      if (!detail.failed) { setNotifications(selectDeskNotifications(detail.items)); setUnreadCount(detail.unreadCount); }
    };
    window.addEventListener("thoidai:notifications", handleNotifications);
    return () => window.removeEventListener("thoidai:notifications", handleNotifications);
  }, []);
  const markRead = (item: NotificationItem) => {
    if (!item.unread) return;
    void fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys: [item.key] }) }).catch(() => null);
    window.dispatchEvent(new CustomEvent("thoidai:notifications-read", { detail: { keys: [item.key] } }));
  };
  const today = blockValue(data.today); const approvals = blockValue(data.approvals); const schedule = blockValue(data.schedule); const shortcuts = blockValue(data.shortcuts);
  const kpis = [{ key: "overdue", label: deskCopy.kpiOverdue, count: today?.overdueCount ?? 0, href: "#desk-today" }, { key: "today", label: deskCopy.kpiToday, count: today?.todayCount ?? 0, href: "#desk-today" }, ...(data.approvals !== null ? [{ key: "approvals", label: deskCopy.kpiApprovals, count: approvals?.total ?? 0, href: "#desk-approvals" }] : []), { key: "notifications", label: deskCopy.kpiNotifications, count: unreadCount, href: "#desk-notifications" }];
  const scheduleGroups = schedule ? [{ title: deskCopy.scheduleDuty, rows: schedule.duty }, { title: deskCopy.schedulePersonal, rows: schedule.personal }, ...(schedule.leadership !== null ? [{ title: deskCopy.scheduleLeadership, rows: schedule.leadership }] : [])].filter((group) => group.rows.length) : [];
  const announcements = blockValue(data.announcements); const library = blockValue(data.library);
  return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6"><div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 lg:flex-row lg:gap-6"><AppNav currentPath="/" userLabel={fullName} avatarUrl={avatarUrl} /><main className="min-w-0 flex-1"><header className="mb-5 rounded-2xl border border-orange-200 bg-white p-4 shadow-sm lg:pr-44"><h1 className="sr-only">{deskCopy.home}</h1><p className="text-2xl font-bold">{greeting}</p><p className="text-sm text-slate-500">{dateLabel}</p><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{kpis.map((kpi) => <a key={kpi.key} href={kpi.href} className="rounded-xl bg-orange-50 p-3"><strong className={`block text-2xl font-bold ${kpi.key === "overdue" && kpi.count > 0 ? "text-red-700" : ""}`}>{kpi.count}</strong><span className="block text-sm">{kpi.label}</span></a>)}</div></header><div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"><div className="min-w-0 space-y-5"><Card id="desk-today" title={deskCopy.blockToday} href="/my-tasks">{data.today?.ok === false ? <Failure name={deskCopy.blockToday} /> : <TodayList items={today?.items ?? []} />}</Card><Card id="desk-shortcuts" title={deskCopy.blockShortcuts}><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{data.shortcuts?.ok === false ? <Failure name={deskCopy.blockShortcuts} /> : shortcuts?.map((item) => <Link key={item.id} href={item.href} className="min-h-11 rounded-xl bg-orange-50 p-3 text-sm font-semibold">{item.label}</Link>)}</div></Card>{data.approvals !== null ? <Card id="desk-approvals" title={deskCopy.blockApprovals} href={approvals?.showQueueLink ? "/tasks?approvalQueue=assignment" : undefined}>{data.approvals?.ok === false ? <Failure name={deskCopy.blockApprovals} /> : <ApprovalList items={approvals?.items ?? []} />}</Card> : null}</div><div className="min-w-0 space-y-5"><Card id="desk-notifications" title={deskCopy.blockNotifications}>{notificationsFailed ? <Failure name={deskCopy.blockNotifications} /> : notificationsLoading ? <p className="text-sm text-slate-500">{deskCopy.notificationsLoading}</p> : <div className="space-y-2">{notifications.length ? notifications.slice(0, 5).map((item, index) => <Link key={item.key} href={item.href} onClick={() => markRead(item)} className={`${rowVisibility(index)} ${listRowClass}`}><span className="min-w-0 flex-1"><span className="line-clamp-2 font-semibold">{item.title}</span><span className="block text-xs text-slate-500">{item.message}</span></span></Link>) : <p className="text-sm text-slate-500">{deskCopy.emptyNotifications}</p>}</div>}</Card><Card id="desk-schedule" title={deskCopy.blockSchedule}>{data.schedule?.ok === false ? <Failure name={deskCopy.blockSchedule} /> : scheduleGroups.length ? scheduleGroups.map((group) => <div key={group.title}><h3 className="mb-2 text-sm font-bold">{group.title}</h3><ScheduleList rows={group.rows} /></div>) : <p className="text-sm text-slate-500">{deskCopy.emptySchedule}</p>}</Card></div></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><Card id="desk-announcements" title={announcementCopy.blockAnnouncements} href="/announcements">{data.announcements?.ok === false ? <Failure name="announcements" /> : announcements?.length ? <div className="space-y-2">{announcements.map((item) => <Link key={item.id} href="/announcements" className="flex min-h-11 items-center gap-2 rounded-xl border p-3"><span className="min-w-0 flex-1"><span className="block font-semibold">{item.title}</span>{item.department ? <span className="block text-xs text-slate-500">{item.department}</span> : null}</span>{item.important ? <span className="text-xs font-semibold text-red-700">{announcementCopy.tagImportant}</span> : null}</Link>)}</div> : <p className="text-sm text-slate-500">{announcementCopy.emptyAnnouncementsBlock}</p>}</Card><Card id="desk-library" title={announcementCopy.blockLibrary} href="/library">{data.library?.ok === false ? <Failure name="library" /> : library?.length ? <div className="space-y-2">{library.map((item) => <Link key={item.id} href="/library" className="block min-h-11 rounded-xl border p-3 font-semibold">{item.title}</Link>)}</div> : <p className="text-sm text-slate-500">{announcementCopy.emptyLibraryBlock}</p>}</Card></div></main></div></div>;
}

