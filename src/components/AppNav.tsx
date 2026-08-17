"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPhase2Navigation, type Phase2Navigation } from "@/components/phase2Navigation";
import { useAuth } from "@/lib/auth";

type AppNavProps = {
  currentPath: string;
  userLabel?: string;
  onLogout: () => void;
};

const labels = {
  assign: "Giao vi\u1ec7c",
  tasks: "Qu\u1ea3n l\u00fd c\u00f4ng vi\u1ec7c",
  account: "T\u00e0i kho\u1ea3n",
  "department-managers": "Tr\u01b0\u1edfng ph\u00f2ng ch\u00ednh",
  "evaluation-rubrics": "B\u1ed9 ti\u00eau ch\u00ed \u0111\u00e1nh gi\u00e1 chung",
} as const;

const linkClass = (active: boolean) =>
  `group flex items-center rounded-lg border-l-4 px-3 py-2.5 text-sm font-semibold transition-colors ${
    active
      ? "border-orange-500 bg-orange-50 text-orange-900 shadow-sm"
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
    <div className="flex h-full flex-col p-4">
      <div className="border-b border-orange-100 pb-4">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-red-600 text-base font-black text-white shadow-sm">TD</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold tracking-wide text-slate-950">TH\u1edcI \u0110\u1ea0I WORK</p>
            <p className="mt-0.5 text-xs text-slate-500">Qu\u1ea3n tr\u1ecb c\u00f4ng vi\u1ec7c n\u1ed9i b\u1ed9</p>
          </div>
        </div>
      </div>

      <nav aria-label="Menu ch\u00ednh" className="mt-4 space-y-1">
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
        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            C\u1ea5u h\u00ecnh
          </p>
          <nav aria-label="C\u1ea5u h\u00ecnh" className="space-y-1">
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
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">\u0110ang \u0111\u0103ng nh\u1eadp</p>
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
          className="mt-2 w-full rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-left text-sm font-semibold text-orange-800 hover:bg-orange-100"
        >
          \u0110\u0103ng xu\u1ea5t
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
    canManageRubrics: hasPermission("can_manage_rubrics"),
    canManageUsers: hasPermission("can_manage_users"),
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
      <button
        ref={menuButtonRef}
        type="button"
        aria-expanded={mobileOpen}
        aria-controls="phase2-mobile-navigation"
        onClick={() => setMobileOpen(true)}
        className="mb-2 w-full rounded-lg border bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 shadow-sm lg:hidden"
      >
        \u2630 Menu
      </button>

      <div className="hidden min-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl border bg-white lg:sticky lg:top-4 lg:block">
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
            aria-label="\u0110\u00f3ng menu"
            onClick={restoreMenuFocus}
            className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          />
          <div
            id="phase2-mobile-navigation"
            ref={mobilePanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu ch\u00ednh"
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
