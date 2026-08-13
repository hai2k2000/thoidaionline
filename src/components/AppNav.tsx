"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  getInitialOpenGroup,
  groups,
  isActive,
  isSidebarGroupVisible,
  toggleOpenGroup,
  type Group,
  type GroupKey,
} from "@/components/appNavState";

type AppNavProps = {
  currentPath: string;
  userLabel?: string;
  onLogout: () => void;
};

export default function AppNav({ currentPath, userLabel, onLogout }: AppNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { hasPermission, canAccessModule } = useAuth();
  const canCreateTask = hasPermission("can_create_task");
  const canManageDocuments = canAccessModule("documents");
  const canSeePerformance = canAccessModule("performance");
  const canSeeHr = canAccessModule("hr");
  const canSeeAssets = canAccessModule("assets");
  const canManageUsers = hasPermission("can_manage_users") || hasPermission("can_manage_permissions");

  const visibleGroups: Group[] = groups
    .map((g) => {
      if (g.key === "work") {
        return {
          ...g,
          items: g.items.filter((i) => {
            if (canCreateTask) return true;
            return i.href === "/tasks/active" || i.href === "/tasks/done";
          }),
        };
      }

      if (g.key === "docs" && !canManageDocuments) {
        return {
          ...g,
          items: g.items.filter((i) => i.href === "/documents/common"),
        };
      }

      if (g.key === "hr") {
        if (!canSeeHr) return { ...g, items: [] };
        return {
          ...g,
          items: g.items.filter((i) => {
            if (i.href === "/performance") return canSeePerformance;
            return true;
          }),
        };
      }

      if (g.key === "assets") {
        if (!canSeeAssets) return { ...g, items: [] };
        return {
          ...g,
          items: g.items.filter((i) => (canCreateTask ? true : i.href === "/assets")),
        };
      }

      if (g.key === "admin") {
        return {
          ...g,
          items: canManageUsers ? g.items : [],
        };
      }

      return g;
    })
    .filter((g) => g.items.length > 0 && isSidebarGroupVisible(g.key));
  const [openGroup, setOpenGroup] = useState<GroupKey | null>(() =>
    getInitialOpenGroup(visibleGroups, currentPath),
  );

  return (
    <aside className="w-full lg:w-[250px]">
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        className="mb-2 w-full rounded border bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 shadow-sm lg:hidden"
      >
        ☰ Menu {mobileOpen ? "▴" : "▾"}
      </button>

      <div className={`${mobileOpen ? "block" : "hidden"} relative z-30 rounded-xl border bg-white p-3 lg:block lg:sticky lg:top-4`}>
        <p className="mb-3 rounded-lg border border-orange-200 bg-gradient-to-r from-orange-50 to-orange-100 px-2 py-1 text-sm font-bold text-orange-600">Menu</p>

        <div className="space-y-3">
          {visibleGroups.map((g) => (
            <div key={g.key}>
              <button
                type="button"
                aria-expanded={openGroup === g.key}
                onClick={() => setOpenGroup((current) => toggleOpenGroup(current, g.key))}
                className="mb-1 flex w-full items-center justify-between rounded border border-orange-200 bg-orange-50/80 px-2 py-1 text-left text-xs font-bold text-orange-600"
              >
                <span>{g.label}</span>
                <span aria-hidden="true">{openGroup === g.key ? "-" : "+"}</span>
              </button>
              {openGroup === g.key ? <div className="space-y-1">
                {g.items.map((i) => {
                  const active = isActive(currentPath, i.href);
                  return (
                    <Link
                      key={i.href}
                      href={i.href}
                      onClick={() => setMobileOpen(false)}
                      className={`block rounded border px-3 py-2 text-sm font-semibold transition ${
                        active
                          ? "border-orange-200 bg-gradient-to-r from-orange-50 to-amber-100 text-orange-800"
                          : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {i.label}
                    </Link>
                  );
                })}
              </div> : null}
            </div>
          ))}
        </div>

        <div className="mt-4 border-t pt-3">
          <p className="mb-2 text-xs text-slate-500">{userLabel ?? "-"}</p>
          <div className="space-y-2">
            <Link
              href="/profile"
              onClick={() => setMobileOpen(false)}
              className={`block rounded border px-3 py-2 text-sm font-semibold ${
                currentPath === "/profile"
                  ? "border-orange-200 bg-gradient-to-r from-orange-50 to-amber-100 text-orange-800"
                  : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Thông tin tài khoản
            </Link>
            <button
              onClick={onLogout}
              className="w-full rounded border border-orange-200 bg-orange-50 px-3 py-2 text-left text-sm font-semibold text-orange-800 hover:bg-orange-100"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
