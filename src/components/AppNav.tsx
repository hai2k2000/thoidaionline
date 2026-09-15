"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPhase2Navigation, type Phase2Navigation } from "@/components/phase2Navigation";
import { useAuth } from "@/lib/auth";
import NotificationBell from "@/components/NotificationBell";
import HelpBot from "@/components/HelpBot";

type AppNavProps = {
  currentPath: string;
  userLabel?: string;
  avatarUrl?: string | null;
  onLogout?: () => void;
};

const labels = {
  assign: "Giao vi\u1ec7c",
  attendance: "Chấm công",
  "attendance-admin": "Chấm công toàn cơ quan",
  "duty-schedule": "Lịch trực",
  "online-work": "Lịch làm trực tuyến (ngoại ngữ)",
  "online-work-admin": "Quản trị lịch online",
  "duty-roster": "Quản trị lịch trực",
  tasks: "Qu\u1ea3n l\u00fd c\u00f4ng vi\u1ec7c",
  evaluations: "\u0110\u00e1nh gi\u00e1 nh\u00e2n vi\u00ean",
  "evaluation-summary": "Bảng đánh giá toàn cơ quan",
  account: "T\u00e0i kho\u1ea3n",
  users: "Qu\u1ea3n l\u00fd nh\u00e2n vi\u00ean",
  departments: "Ph\u00f2ng ban",
  permissions: "Ph\u00e2n quy\u1ec1n",
  "evaluation-rubrics": "Bộ tiêu chí đánh giá",
  "evaluation-cycles": "Quản trị kỳ đánh giá",
  "work-schedule": "Lịch làm việc",
  "work-schedule-leader": "Lịch công tác lãnh đạo",
  "work-schedule-staff": "Kế hoạch cá nhân",
  "work-schedule-admin": "Quản trị lịch công tác",
} as const;

function NavIcon({ id, active }: { id: keyof typeof labels; active: boolean }) {
  const calendar = id === "attendance" || id === "attendance-admin" || id.includes("duty") || id.includes("online") || id.includes("work-schedule");
  const people = id === "users" || id === "departments" || id === "evaluations" || id === "evaluation-summary";
  const settings = id === "permissions" || id.includes("evaluation-");
  return <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${active ? "bg-orange-500 text-white shadow-sm" : "bg-white text-slate-500 ring-1 ring-slate-200 group-hover:bg-orange-100 group-hover:text-orange-700 group-hover:ring-orange-200"}`}><svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{calendar ? <><path d="M6 3v3M18 3v3M4 9h16"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="m9 15 2 2 4-5"/></> : people ? <><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2M16 5.5a3 3 0 0 1 0 5.5M18 14a5 5 0 0 1 2.5 4.3V20"/></> : settings ? <><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="13" cy="18" r="2"/></> : id === "account" ? <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></> : id === "assign" ? <><path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="10"/></> : <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>}</svg></span>;
}

function ChevronIcon({ open }: { open?: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}><path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const linkClass = (active: boolean) =>
  `group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold transition-all ${
    active
      ? "bg-gradient-to-r from-orange-100 to-orange-50 text-orange-950 shadow-sm ring-1 ring-orange-200 before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r-full before:bg-orange-500"
      : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
  }`;

function isNavigationActive(currentPath: string, href: string) {
  if (href === "/tasks/assign") return currentPath === href;
  if (href === "/tasks") {
    return currentPath.startsWith("/tasks") && currentPath !== "/tasks/assign";
  }
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function NavContent({
  currentPath,
  navigation,
  onNavigate,
  onLogout,
  userLabel,
  avatarUrl,
}: {
  currentPath: string;
  navigation: Phase2Navigation;
  onNavigate: () => void;
  onLogout: () => void;
  userLabel?: string;
  avatarUrl?: string | null;
}) {
  const configurationActive = navigation.configuration.some((item) =>
    isNavigationActive(currentPath, item.href));
  const workScheduleActive = navigation.primary.some((item) =>
    ["work-schedule", "work-schedule-leader", "work-schedule-staff", "duty-schedule", "online-work"].includes(item.id) && isNavigationActive(currentPath, item.href));
  const [configurationOpen, setConfigurationOpen] = useState(configurationActive);
  const [workScheduleOpen, setWorkScheduleOpen] = useState(workScheduleActive);
  const [accountOpen, setAccountOpen] = useState(true);


  return (
    <div className="flex h-full flex-col p-3.5">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 via-white to-amber-50 px-3 py-3.5 text-center ring-1 ring-orange-100 before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-orange-500 before:via-red-500 before:to-amber-400">
        <span className="mx-auto flex h-12 w-36 items-center justify-center overflow-hidden px-1"><Image src="/thoidai-logo.png" alt="Logo Thời Đại" width={144} height={48} priority className="h-auto w-full object-contain" /></span>
        <p className="mt-1.5 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Quản trị công việc nội bộ</p>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50/80 p-2 ring-1 ring-slate-200/80">
      <div className="mb-2.5 flex items-center justify-between rounded-xl bg-gradient-to-r from-orange-100 to-amber-50 px-2.5 py-2 ring-1 ring-orange-200"><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500 text-white"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="2"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></span><p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-orange-900">Công việc</p></div><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-orange-700 ring-1 ring-orange-200">{navigation.primary.length}</span></div>
      <nav aria-label="Menu chính" className="space-y-1">
            {navigation.primary.filter((item) => !["work-schedule-leader", "work-schedule-staff", "duty-schedule", "online-work"].includes(item.id)).map((item) => (
              item.id === "work-schedule" ? <details key={item.id} open={workScheduleOpen || workScheduleActive} onToggle={(event) => setWorkScheduleOpen(event.currentTarget.open)} className="group"><summary className={linkClass(workScheduleActive)}><NavIcon id={item.id} active={workScheduleActive} /><span className="leading-snug">{labels[item.id]}</span><span className="ml-auto"><ChevronIcon open={workScheduleOpen || workScheduleActive} /></span></summary><div className="ml-8 mt-1 space-y-1 border-l border-orange-200 pl-2">{navigation.primary.filter((child) => ["work-schedule-leader", "work-schedule-staff", "duty-schedule", "online-work"].includes(child.id)).map((child) => <Link key={child.id} href={child.href} aria-current={isNavigationActive(currentPath, child.href) ? "page" : undefined} onClick={onNavigate} className={linkClass(isNavigationActive(currentPath, child.href))}><span className="leading-snug">{labels[child.id]}</span></Link>)}</div></details> : (
              <Link
            key={item.id}
            href={item.href}
            aria-current={isNavigationActive(currentPath, item.href) ? "page" : undefined}
            onClick={onNavigate}
            className={linkClass(isNavigationActive(currentPath, item.href))}
          >
            <NavIcon id={item.id} active={isNavigationActive(currentPath, item.href)} /><span className="leading-snug">{labels[item.id]}</span>
          </Link>
              )
            ))}
      </nav>
      </div>

      {navigation.configuration.length > 0 ? (
        <details open={configurationOpen || configurationActive} onToggle={(event) => setConfigurationOpen(event.currentTarget.open)} className="group mt-3 rounded-2xl bg-slate-50/80 p-2 ring-1 ring-slate-200/80">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl bg-gradient-to-r from-slate-200 to-slate-50 px-2.5 py-2 ring-1 ring-slate-300 [&::-webkit-details-marker]:hidden"><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-600 text-white"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="2"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="13" cy="18" r="2"/></svg></span><p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-800">Cấu hình</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-300">{navigation.configuration.length}</span><ChevronIcon open={configurationOpen || configurationActive} /></div></summary>
          <nav aria-label="Cấu hình" className="mt-2.5 space-y-1">
            {navigation.configuration.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                aria-current={isNavigationActive(currentPath, item.href) ? "page" : undefined}
                onClick={onNavigate}
                className={linkClass(isNavigationActive(currentPath, item.href))}
              >
                <NavIcon id={item.id} active={isNavigationActive(currentPath, item.href)} /><span className="leading-snug">{labels[item.id]}</span>
              </Link>
            ))}
          </nav>
        </details>
      ) : null}

      <div className="mt-auto pt-3">
        <details open={accountOpen} onToggle={(event) => setAccountOpen(event.currentTarget.open)} className="group rounded-2xl bg-gradient-to-br from-slate-50 to-orange-50 p-2 ring-1 ring-slate-200 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-xl bg-white/80 px-2.5 py-2.5 ring-1 ring-white [&::-webkit-details-marker]:hidden">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-100 text-sm font-bold text-orange-700 ring-2 ring-white shadow-sm">{avatarUrl ? <img src={avatarUrl} alt="Ảnh đại diện" className="h-full w-full object-cover" /> : (userLabel?.trim().charAt(0).toUpperCase() ?? "?")}</span><div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tài khoản</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-slate-700">{userLabel ?? "-"}</p>
          </div><span className="ml-auto text-slate-500"><ChevronIcon open={accountOpen} /></span>
        </summary>
        <div className="mt-2 space-y-1">{navigation.account.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            aria-current={isNavigationActive(currentPath, item.href) ? "page" : undefined}
            onClick={onNavigate}
            className={linkClass(isNavigationActive(currentPath, item.href))}
          >
            <NavIcon id={item.id} active={isNavigationActive(currentPath, item.href)} /><span>{labels[item.id]}</span>
          </Link>
        ))}</div>
        <button
          type="button"
          onClick={() => {
            onNavigate();
            onLogout();
          }}
          className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white/90 px-3 py-2.5 text-sm font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100 hover:text-orange-900"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2"><path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></svg> Đăng xuất
        </button>
        </details>
      </div>
    </div>
  );
}

export default function AppNav({ currentPath, userLabel }: AppNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const { user, hasPermission, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const performLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
    window.location.assign("/login");
  };

  const navigation = getPhase2Navigation({
    roleCode: user?.role_code ?? "",
    canAssignTask: hasPermission("can_assign_task"),
    canEvaluateStep1: hasPermission("can_evaluate_step1"),
    canEvaluateStep2: hasPermission("can_evaluate_step2"),
    isDepartmentManager: user?.is_department_manager === true,
    canManageRubrics: hasPermission("can_manage_rubrics"),
    canManageUsers: hasPermission("can_manage_users"),
    canManagePermissions: hasPermission("can_manage_permissions"),
  });

  const restoreMenuFocus = useCallback(() => {
    setMobileOpen(false);
    window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const panel = mobilePanelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),summary',
    );
    focusable?.[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        restoreMenuFocus();
        return;
      }
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, restoreMenuFocus]);

  return (
    <aside className="w-full lg:w-[252px] lg:shrink-0">
      <div className="fixed right-4 top-4 z-[60]">
        <NotificationBell />
      </div>
      <HelpBot />
      <button
        ref={menuButtonRef}
        type="button"
        aria-expanded={mobileOpen}
        aria-controls="phase2-mobile-navigation"
        onClick={() => setMobileOpen(true)}
        className="mb-2 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-800 shadow-sm lg:hidden"
      >
        <span>Menu chức năng</span><svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 text-orange-600" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>

      <div className="hidden max-h-[calc(100vh-1.5rem)] min-h-[640px] overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.08)] lg:sticky lg:top-3 lg:block">
        <NavContent
          currentPath={currentPath}
          navigation={navigation}
          onNavigate={() => undefined}
          onLogout={performLogout}
          userLabel={userLabel}
          avatarUrl={user?.avatar_url}
        />
      </div>

      {mobileOpen ? (
        <>
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={restoreMenuFocus}
            className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          />
          <div
            id="phase2-mobile-navigation"
            ref={mobilePanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu chính"
            className="fixed inset-y-0 left-0 z-50 w-[min(280px,calc(100vw-32px))] overflow-y-auto border-r bg-white shadow-2xl lg:hidden"
          >
            <NavContent
              currentPath={currentPath}
              navigation={navigation}
              onNavigate={restoreMenuFocus}
              onLogout={performLogout}
              userLabel={userLabel}
              avatarUrl={user?.avatar_url}
            />
          </div>
        </>
      ) : null}
    </aside>
  );
}
