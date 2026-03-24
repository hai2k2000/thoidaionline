"use client";

import Link from "next/link";
import { useState } from "react";

type AppNavProps = {
  currentPath: string;
  userLabel?: string;
  onLogout: () => void;
};

type Group = {
  key: "work" | "hr" | "docs" | "admin";
  label: string;
  items: { href: string; label: string }[];
};

const groups: Group[] = [
  {
    key: "work",
    label: "Quản lý công việc",
    items: [
      { href: "/", label: "Giao việc" },
      { href: "/tasks/active", label: "CV đang triển khai" },
      { href: "/tasks/pending-review", label: "CV chờ duyệt" },
      { href: "/tasks/done", label: "CV hoàn thành" },
    ],
  },
  {
    key: "hr",
    label: "Quản lý nhân sự",
    items: [
      { href: "/hr-profiles", label: "Hồ sơ nhân sự" },
      { href: "/attendance", label: "Chấm công" },
      { href: "/performance", label: "Đánh giá" },
      { href: "/assets", label: "Tài sản" },
    ],
  },
  {
    key: "docs",
    label: "Quản lý công văn",
    items: [{ href: "/documents", label: "Công văn" }],
  },
  {
    key: "admin",
    label: "Quản trị phần mềm",
    items: [
      { href: "/users", label: "Quản lý nhân viên" },
      { href: "/departments", label: "Phòng ban" },
      { href: "/permissions", label: "Phân quyền" },
    ],
  },
];

const isActive = (currentPath: string, href: string) => {
  if (href === "/") return currentPath === "/";
  if (href.startsWith("/tasks/") && currentPath.startsWith("/tasks/")) return true;
  return currentPath === href;
};

export default function AppNav({ currentPath, userLabel, onLogout }: AppNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <aside className="w-full lg:float-left lg:mr-4 lg:w-[250px]">
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        className="mb-2 w-full rounded border bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 shadow-sm lg:hidden"
      >
        ☰ Menu {mobileOpen ? "▴" : "▾"}
      </button>

      <div className={`${mobileOpen ? "block" : "hidden"} rounded-xl border bg-white p-3 lg:block lg:sticky lg:top-4`}>
        <p className="mb-3 text-sm font-bold text-slate-700">Menu</p>

        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{g.label}</p>
              <div className="space-y-1">
                {g.items.map((i) => {
                  const active = isActive(currentPath, i.href);
                  return (
                    <Link
                      key={i.href}
                      href={i.href}
                      onClick={() => setMobileOpen(false)}
                      className={`block rounded border px-3 py-2 text-sm font-semibold transition ${
                        active
                          ? "border-red-200 bg-gradient-to-r from-cyan-50 to-blue-200 text-blue-800"
                          : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {i.label}
                    </Link>
                  );
                })}
              </div>
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
                  ? "border-red-200 bg-gradient-to-r from-cyan-50 to-blue-200 text-blue-800"
                  : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Thông tin tài khoản
            </Link>
            <button
              onClick={onLogout}
              className="w-full rounded border border-rose-200 bg-rose-50 px-3 py-2 text-left text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
