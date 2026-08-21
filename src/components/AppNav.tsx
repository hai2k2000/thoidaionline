"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPhase2Navigation, type Phase2Navigation } from "@/components/phase2Navigation";
import { useAuth } from "@/lib/auth";
import NotificationBell from "@/components/NotificationBell";

type AppNavProps = {
  currentPath: string;
  userLabel?: string;
  onLogout: () => void;
};

const labels = {
  assign: "Giao vi\u1ec7c",
  tasks: "Qu\u1ea3n l\u00fd c\u00f4ng vi\u1ec7c",
  evaluations: "\u0110\u00e1nh gi\u00e1 nh\u00e2n vi\u00ean",
  account: "T\u00e0i kho\u1ea3n",
  users: "Qu\u1ea3n l\u00fd nh\u00e2n vi\u00ean",
  departments: "Ph\u00f2ng ban",
  permissions: "Ph\u00e2n quy\u1ec1n",
  "evaluation-rubrics": "Tiêu chí & kỳ đánh giá",
} as const;

const linkClass = (active: boolean) =>
  `group flex items-center rounded-xl border-l-4 px-3 py-2.5 text-sm font-semibold transition-all ${
    active
      ? "border-orange-500 bg-orange-50 text-orange-900 shadow-sm ring-1 ring-orange-100"
      : "border-transparent text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
  }`;

function isNavigationActive(currentPath: string, href: string) {
  if (href === "/tasks/assign") return currentPath === href;
  if (href === "/tasks") {
    return currentPath.startsWith("/tasks") && currentPath !== "/tasks/assign";
  }
  return currentPath === href;
}

function NavContent({
  currentPath,
  navigation,
  onNavigate,
  onLogout,
  userLabel,
}: {
  currentPath: string;
  navigation: Phase2Navigation;
  onNavigate: () => void;
  onLogout: () => void;
  userLabel?: string;
}) {
  return (
    <div className="flex h-full flex-col p-3">
      <div className="border-b border-orange-100 pb-3 text-center">
        <span aria-hidden="true" className="mx-auto flex h-12 w-36 items-center justify-center overflow-hidden rounded-lg bg-white px-1"><img src="/thoidai-logo.png" alt="Logo Thời Đại" className="h-auto w-full object-contain" /></span>
        <p className="mt-2 text-xs font-semibold text-slate-600">Quản trị công việc nội bộ</p>
      </div>

      <nav aria-label="Menu chính" className="mt-3 space-y-0.5">
        {navigation.primary.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            onClick={onNavigate}
            className={linkClass(isNavigationActive(currentPath, item.href))}
          >
            {labels[item.id]}
          </Link>
        ))}
      </nav>

      {navigation.configuration.length > 0 ? (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Cấu hình
          </p>
          <nav aria-label="Cấu hình" className="space-y-1">
            {navigation.configuration.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={onNavigate}
                className={linkClass(isNavigationActive(currentPath, item.href))}
              >
                {labels[item.id]}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}

      <div className="mt-auto border-t border-slate-200 pt-4">
        <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Đang đăng nhập</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-slate-700">{userLabel ?? "-"}</p>
        </div>
        {navigation.account.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            onClick={onNavigate}
            className={linkClass(isNavigationActive(currentPath, item.href))}
          >
            {labels[item.id]}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => {
            onNavigate();
            onLogout();
          }}
          className="mt-2 w-full rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-left text-sm font-semibold text-orange-800 transition hover:bg-orange-100"
        >
          Đăng xuất
        </button>
      </div>
    </div>
  );
}

export default function AppNav({ currentPath, userLabel, onLogout }: AppNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const { user, hasPermission } = useAuth();

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
      'a[href],button:not([disabled])',
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
    <aside className="w-full lg:w-[232px] lg:shrink-0">
      <div className="fixed right-4 top-4 z-[60]">
        <NotificationBell />
      </div>
      <button
        ref={menuButtonRef}
        type="button"
        aria-expanded={mobileOpen}
        aria-controls="phase2-mobile-navigation"
        onClick={() => setMobileOpen(true)}
        className="mb-2 w-full rounded-lg border bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 shadow-sm lg:hidden"
      >
        ☰ Menu
      </button>

      <div className="hidden max-h-[calc(100vh-1.5rem)] min-h-[640px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-3 lg:block">
        <NavContent
          currentPath={currentPath}
          navigation={navigation}
          onNavigate={() => undefined}
          onLogout={onLogout}
          userLabel={userLabel}
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
            className="fixed inset-y-0 left-0 z-50 w-[min(232px,calc(100vw-48px))] overflow-y-auto border-r bg-white shadow-2xl lg:hidden"
          >
            <NavContent
              currentPath={currentPath}
              navigation={navigation}
              onNavigate={restoreMenuFocus}
              onLogout={onLogout}
              userLabel={userLabel}
            />
          </div>
        </>
      ) : null}
    </aside>
  );
}
