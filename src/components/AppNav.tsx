"use client";

import { isCollaboratorRole } from "@/lib/collaboratorRole.mjs";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPhase2Navigation, isNavigationActive, type Phase2Navigation } from "@/components/phase2Navigation";
import { useAuth } from "@/lib/auth";
import { canUseJournalism } from "@/lib/journalismScope.mjs";
import NotificationBell from "@/components/NotificationBell";
import HelpBot from "@/components/HelpBot";
import { usePathname } from "next/navigation";
import { getMobileNavigation, isMobileNavigationActive, isMobileKeyboardOpen, isVisibleMobileOverlay } from "@/components/mobileNavigation";
import { createPortal } from "react-dom";
import InstallAppLink from "@/components/InstallAppLink";

type AppNavProps = {
  currentPath: string;
  userLabel?: string;
  avatarUrl?: string | null;
  onLogout?: () => void;
};

const labels = {
  projects: "D\u1ef1 \u00e1n",
  assign: "Giao vi\u1ec7c",
  attendance: "Chấm công",
  "attendance-admin": "Chấm công toàn cơ quan",
  "duty-schedule": "Lịch trực",
  "online-work": "Lịch làm trực tuyến (ngoại ngữ)",
  "online-work-admin": "Quản trị lịch online",
  "duty-roster": "Quản trị lịch trực",
  tasks: "Qu\u1ea3n l\u00fd c\u00f4ng vi\u1ec7c",
  "work-report": "Báo cáo công việc",
  "weekly-report": "Báo cáo tuần",
  "department-plan": "Kế hoạch phòng ban",
  evaluations: "\u0110\u00e1nh gi\u00e1 nh\u00e2n vi\u00ean",
  "evaluation-summary": "Bảng đánh giá toàn cơ quan",
  account: "T\u00e0i kho\u1ea3n",
  users: "Qu\u1ea3n l\u00fd nh\u00e2n vi\u00ean",
  departments: "Ph\u00f2ng ban",
  permissions: "Ph\u00e2n quy\u1ec1n",
  assets: "Quản lý tài sản",
  "my-assets": "Tài sản của tôi",
  "asset-status-requests": "Duyệt tình trạng tài sản",
  "evaluation-rubrics": "Bộ tiêu chí đánh giá",
  "evaluation-cycles": "Quản trị kỳ đánh giá",
  "work-schedule": "Lịch làm việc",
  "work-schedule-leader": "Lịch công tác lãnh đạo",
  "work-schedule-staff": "Kế hoạch cá nhân",
  "work-schedule-admin": "Quản trị lịch công tác",
  "journalism-tasks": "Công việc nghiệp vụ báo chí",
  "journalism-structures": "Chủ đề / Loạt bài",
  "journalism-reports": "Báo cáo nghiệp vụ báo chí",
  "journalism-calendar": "Lịch biên tập",
  database: "Cơ sở dữ liệu",
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
  `group relative flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold transition-all lg:min-h-0 ${
    active
      ? "bg-gradient-to-r from-orange-100 to-orange-50 text-orange-950 shadow-sm ring-1 ring-orange-200 before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r-full before:bg-orange-500"
      : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
  }`;

function NavContent({
  currentPath,
  navigation,
  onNavigate,
  onLogout,
  userLabel,
  avatarUrl,
  mobile = false,
}: {
  currentPath: string;
  navigation: Phase2Navigation;
  onNavigate: () => void;
  onLogout: () => void;
  userLabel?: string;
  avatarUrl?: string | null;
  mobile?: boolean;
}) {
  const configurationActive = navigation.configuration.some((item) =>
    isNavigationActive(currentPath, item.href));
  const workScheduleActive = navigation.primary.some((item) =>
    ["work-schedule", "work-schedule-leader", "work-schedule-staff", "duty-schedule", "online-work"].includes(item.id) && isNavigationActive(currentPath, item.href));
  const journalismActive = navigation.journalism.some((item) => isNavigationActive(currentPath, item.href));
  const [configurationOpen, setConfigurationOpen] = useState(configurationActive);
  const [workScheduleOpen, setWorkScheduleOpen] = useState(workScheduleActive);
  const [journalismOpen, setJournalismOpen] = useState(journalismActive);
  const [accountOpen, setAccountOpen] = useState(true);


  return (
    <div className="flex h-full flex-col p-3.5">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 via-white to-amber-50 px-3 py-3.5 text-center ring-1 ring-orange-100 before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-orange-500 before:via-red-500 before:to-amber-400">
        <span className="mx-auto flex h-12 w-36 items-center justify-center overflow-hidden px-1"><Image src="/thoidai-logo.png" alt="Logo Thời Đại" width={144} height={48} priority className="h-auto w-full object-contain" /></span>
        <p className="mt-1.5 whitespace-nowrap text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Quản trị công việc nội bộ</p>
      </div>

      {navigation.primary.length > 0 ? <div className="mt-4 rounded-2xl bg-slate-50/80 p-2 ring-1 ring-slate-200/80">
      <div className="mb-2.5 flex items-center justify-between rounded-xl bg-gradient-to-r from-orange-100 to-amber-50 px-2.5 py-2 ring-1 ring-orange-200"><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500 text-white"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="2"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></span><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-orange-900">Công việc</p></div><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-orange-700 ring-1 ring-orange-200">{navigation.primary.length}</span></div>
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
            <NavIcon id={item.id} active={isNavigationActive(currentPath, item.href)} /><span className="leading-snug">{item.href === "/my-tasks" ? "C\u00f4ng vi\u1ec7c c\u1ee7a t\u00f4i" : labels[item.id]}</span>
          </Link>
              )
            ))}
      </nav>
      </div> : null}

      {navigation.journalism.length > 0 ? (
        <details open={journalismOpen || journalismActive} onToggle={(event) => setJournalismOpen(event.currentTarget.open)} className="group mt-3 rounded-2xl bg-slate-50/80 p-2 ring-1 ring-slate-200/80">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl bg-gradient-to-r from-red-100 to-orange-50 px-2.5 py-2 ring-1 ring-red-200 [&::-webkit-details-marker]:hidden"><div className="flex items-center gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="2"><path d="M4 6h16M4 12h11M4 18h16"/><circle cx="18" cy="12" r="2"/></svg></span><p className="min-w-0 text-xs font-extrabold uppercase leading-snug tracking-wide text-red-900">NGHIỆP VỤ BÁO CHÍ</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-red-700 ring-1 ring-red-200">{navigation.journalism.length}</span><ChevronIcon open={journalismOpen || journalismActive} /></div></summary>
          <nav aria-label="Nghiệp vụ báo chí" className="mt-2.5 space-y-1">
            {navigation.journalism.map((item) => (
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

      {navigation.configuration.length > 0 ? (
        <details open={configurationOpen || configurationActive} onToggle={(event) => setConfigurationOpen(event.currentTarget.open)} className="group mt-3 rounded-2xl bg-slate-50/80 p-2 ring-1 ring-slate-200/80">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl bg-gradient-to-r from-slate-200 to-slate-50 px-2.5 py-2 ring-1 ring-slate-300 [&::-webkit-details-marker]:hidden"><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-600 text-white"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="2"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="13" cy="18" r="2"/></svg></span><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-800">Cấu hình</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600 ring-1 ring-slate-300">{navigation.configuration.length}</span><ChevronIcon open={configurationOpen || configurationActive} /></div></summary>
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
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tài khoản</p>
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
        ))}<Link href="/app" onClick={onNavigate} aria-current={currentPath === "/app" ? "page" : undefined} className={linkClass(currentPath === "/app")}>Ứng dụng di động</Link></div>
        {!mobile || navigation.primary.length > 0 ? <button
          type="button"
          onClick={() => {
            onNavigate();
            onLogout();
          }}
          className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white/90 px-3 py-2.5 text-sm font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100 hover:text-orange-900"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2"><path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></svg> Đăng xuất
        </button> : null}
        </details>
      </div>
    </div>
  );
}

export default function AppNav({ currentPath, userLabel }: AppNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileObscured, setMobileObscured] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const { user, hasPermission, logout } = useAuth();
  const [projectMembership, setProjectMembership] = useState<{ userId: string; value: boolean } | null>(null);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    fetch("/api/projects/access", { signal: controller.signal }).then((response) => response.ok ? response.json() : null).then((data) => { if (!controller.signal.aborted) setProjectMembership({ userId: user.id, value: data?.hasMembership === true }); }).catch(() => {});
    return () => controller.abort();
  }, [user, currentPath]);
  const [loggingOut, setLoggingOut] = useState(false);
  const performLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
    window.location.assign("/login");
  };

  const navigation = getPhase2Navigation({
    hasProjectMembership: projectMembership?.userId === user?.id && projectMembership?.value === true,
    canCreateProject: Boolean(user?.rbacPermissionScopes?.["project.create"]?.length),
    roleCode: user?.role_code ?? "",
    departmentCode: user?.department_code,
    canAccessJournalism: user ? canUseJournalism({ roleCode: user.role_code, departmentCode: user.department_code, rbacPermissions: user.rbacPermissions }) : false,
    canAssignTask: hasPermission("can_assign_task"),
    canEvaluateStep1: hasPermission("can_evaluate_step1"),
    canEvaluateStep2: hasPermission("can_evaluate_step2"),
    isDepartmentManager: user?.is_department_manager === true,
    canManageRubrics: hasPermission("can_manage_rubrics"),
    canManageUsers: hasPermission("can_manage_users"),
    canManagePermissions: hasPermission("can_manage_permissions"),
    canManageJournalismStructures: hasPermission("journalism.structure.manage"),
    canViewAssets: hasPermission("asset.view"),
    canManageAssets: hasPermission("asset.manage"),
    canViewDatabase: true,
    rbacPermissionScopes: user?.rbacPermissionScopes,
  });
  const mobileNavigation = getMobileNavigation(navigation, user?.role_code ?? "");
  const mobilePath = pathname ?? currentPath.split("?")[0];
  const mobileActive = (href: string) => isMobileNavigationActive(`${mobilePath}?${currentPath.split("?")[1] ?? ""}`, href);
  const activeItem = mobileNavigation.items.find((item) => mobileActive(item.href));
  const pageItem = [...navigation.primary, ...navigation.configuration, ...navigation.account].find((item) => isNavigationActive(currentPath, item.href));
  const mobileTitle = mobilePath === "/app" ? "Ứng dụng di động" : activeItem?.label ?? (pageItem ? labels[pageItem.id] : "Thời Đại Work");

  useEffect(() => {
    const viewport = window.visualViewport;
    let baselineHeight = window.innerHeight;
    let width = window.innerWidth;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (width !== window.innerWidth) {
        width = window.innerWidth;
        baselineHeight = window.innerHeight;
      }
      const focused = document.activeElement;
      const editableFocused = focused instanceof HTMLElement && (focused.isContentEditable
        || focused.matches('textarea:not([readonly]):not([disabled]), input:not([readonly]):not([disabled]):is(:not([type]), [type="text"], [type="search"], [type="email"], [type="url"], [type="tel"], [type="password"], [type="number"])'));
      const viewportHeight = viewport?.height ?? window.innerHeight;
      if (!editableFocused || viewportHeight > baselineHeight) baselineHeight = Math.max(window.innerHeight, viewportHeight);
      const keyboardOpen = isMobileKeyboardOpen({ baselineHeight, viewportHeight, scale: viewport?.scale ?? 1, editableFocused });
      const overlayOpen = Array.from(document.querySelectorAll('[aria-modal="true"], dialog[open], .mobile-dialog-overlay, .mobile-filter-panel[data-open="true"]'))
        .some((element) => isVisibleMobileOverlay(element, (node) => window.getComputedStyle(node)));
      setMobileObscured(keyboardOpen || overlayOpen);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden", "inert", "open", "aria-modal", "aria-hidden", "data-open", "data-state"] });
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    document.addEventListener("transitionend", schedule);
    document.addEventListener("animationend", schedule);
    window.addEventListener("resize", schedule);
    viewport?.addEventListener("resize", schedule);
    schedule();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      document.removeEventListener("transitionend", schedule);
      document.removeEventListener("animationend", schedule);
      window.removeEventListener("resize", schedule);
      viewport?.removeEventListener("resize", schedule);
    };
  }, []);

  const restoreMenuFocus = useCallback(() => {
    setMobileOpen(false);
    window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = mobilePanelRef.current;
    panel?.querySelector<HTMLElement>('button')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        restoreMenuFocus();
        return;
      }
      const focusable = Array.from(panel?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),summary') ?? []).filter((node) => node.getClientRects().length);
      if (event.key !== "Tab" || !focusable.length) return;
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
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; };
  }, [mobileOpen, restoreMenuFocus]);

  return (
    <aside data-app-navigation className="w-full lg:w-[252px] lg:shrink-0">
      <div className="desktop-notifications fixed right-4 top-4 z-[60] hidden items-center gap-2 lg:flex">
        <InstallAppLink />{!isCollaboratorRole(user?.role_code) && <NotificationBell />}
      </div>
      {!isCollaboratorRole(user?.role_code) && <HelpBot />}
      <div className="mobile-app-bar mb-3 lg:hidden">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-orange-700">Thời Đại Work</p>
          <p data-testid="mobile-nav-title" className="truncate text-sm font-bold text-slate-900 lg:hidden">{mobileTitle}</p>
          <p className="hidden truncate text-sm font-bold text-slate-900 lg:block">{labels[(navigation.primary.find((item) => isNavigationActive(currentPath, item.href)) ?? navigation.configuration.find((item) => isNavigationActive(currentPath, item.href)) ?? navigation.account[0])?.id ?? "tasks"]}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 lg:hidden"><InstallAppLink mobile />{!isCollaboratorRole(user?.role_code) && <NotificationBell />}<Link href="/account" aria-label="Tài khoản của tôi" className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-orange-100 font-bold text-orange-800">{(user?.full_name ?? userLabel ?? "?").trim().charAt(0).toUpperCase()}</Link></div>
      </div>
      {user && !["/login", "/forgot-password", "/reset-password"].includes(mobilePath) ? <nav aria-label="Điều hướng di động" data-obscured={mobileOpen || mobileObscured} className="mobile-bottom-nav lg:hidden" style={{ position: "fixed" }}>
        {mobileNavigation.items.filter((item) => item.href !== "more").map((item) => <Link key={item.id} href={item.href} aria-current={mobileActive(item.href) ? "page" : undefined} className={`mobile-bottom-item ${mobileActive(item.href) ? "is-active" : ""}`}><MobileIcon kind={item.kind} /><span>{item.label}</span></Link>)}
      <button
        data-testid="mobile-nav-trigger"
        ref={menuButtonRef}
        type="button"
        aria-label="Mở menu chức năng"
        aria-expanded={mobileOpen}
        aria-controls="phase2-mobile-navigation"
        onClick={() => setMobileOpen(true)}
        className={`mobile-bottom-item min-h-[48px] ${mobileOpen || !activeItem ? "is-active" : ""}`}
      >
        <MobileIcon kind="more" /><span>Thêm</span>
      </button>
      </nav> : null}

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

      {mobileOpen ? createPortal((
        <>
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={restoreMenuFocus}
            style={{ position: "fixed" }}
            className="fixed inset-0 z-[80] bg-slate-950/40 lg:hidden"
          />
          <div
            id="phase2-mobile-navigation"
            ref={mobilePanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu chính"
            style={{ position: "fixed" }}
            className="mobile-menu-sheet fixed inset-x-0 bottom-0 z-[81] max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl lg:hidden"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-2"><h2 className="font-bold">Thêm</h2><button type="button" onClick={restoreMenuFocus} className="min-h-11 min-w-11 rounded-lg px-3 font-semibold">Đóng</button></div>
            {mobileNavigation.showHelp ? <button type="button" onClick={() => { setMobileOpen(false); window.dispatchEvent(new CustomEvent("thoidai:open-help")); }} className="mx-4 mt-3 flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-orange-50"><svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.6 8.6 0 0 1-3.4-.7L4 20l1.7-3.6A7.5 7.5 0 1 1 20 11.5Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></svg>Trợ giúp</button> : null}
            <NavContent
              currentPath={currentPath}
              navigation={mobileNavigation.menu}
              mobile
              onNavigate={restoreMenuFocus}
              onLogout={performLogout}
              userLabel={userLabel}
              avatarUrl={user?.avatar_url}
            />
          </div>
        </>
      ), document.body) : null}
    </aside>
  );
}

function MobileIcon({ kind }: { kind: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{kind === "home" ? <><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7" /></> : kind === "projects" ? <path d="M3 7V5a2 2 0 0 1 2-2h5l3 4h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /> : kind === "attendance" ? <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18m-13 5 3 3 5-5" /></> : kind === "more" ? <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></> : <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="m8 9 2 2 5-5M8 16h8" /></>}</svg>;
}

