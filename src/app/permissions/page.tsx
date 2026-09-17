"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import type { PermissionMatrixRole } from "@/lib/permissionMatrix";

const scopeLabels: Record<string, string> = {
  self: "Cá nhân",
  assigned: "Được giao / liên quan",
  department: "Phòng ban",
  all: "Toàn cơ quan",
};

export default function PermissionsPage() {
  const router = useRouter();
  const { loading: authLoading, user, logout } = useAuth();
  const [roles, setRoles] = useState<PermissionMatrixRole[]>([]);
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("Đang tải ma trận phân quyền...");

  const load = useCallback(async () => {
    setMessage("Đang tải ma trận phân quyền...");
    const response = await fetch("/api/permissions", { cache: "no-store", credentials: "same-origin" });
    const payload = await response.json().catch(() => ({})) as { roles?: PermissionMatrixRole[] };
    if (!response.ok) {
      setMessage("Không thể tải ma trận phân quyền.");
      if (response.status === 401) router.push("/login");
      if (response.status === 403) router.push("/");
      return;
    }
    setRoles(payload.roles ?? []);
    setMessage("Dữ liệu chỉ đọc từ RBAC hiện hành.");
  }, [router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [authLoading, load, router, user]);

  const visibleRoles = useMemo(() => {
    const needle = query.normalize("NFC").trim().toLocaleLowerCase("vi");
    return roles.filter((role) => {
      if (status === "active" && !role.active) return false;
      if (status === "inactive" && role.active) return false;
      if (!needle) return true;
      return [role.code, role.name, ...role.modules.flatMap((module) => [module.key, ...module.permissions.flatMap((permission) => [permission.code, permission.name])])]
        .some((value) => value.toLocaleLowerCase("vi").includes(needle));
    });
  }, [query, roles, status]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#fff7ed,_#f8fafc_38%)] p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-5">
        <div className="mb-4 lg:mb-0"><AppNav currentPath="/permissions" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} avatarUrl={user?.avatar_url} onLogout={logout} /></div>
        <div className="min-w-0">
          <header className="mb-5 overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 via-red-500 to-amber-400" />
            <div className="p-5 sm:flex sm:items-end sm:justify-between sm:gap-6">
              <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">RBAC · Chỉ đọc</p><h1 className="mt-1 text-2xl font-bold">Ma trận phân quyền</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Vai trò → Mô-đun → Quyền → Phạm vi. Dữ liệu lấy trực tiếp từ permission grants hiện hành; màn hình này không thay đổi quyền.</p></div>
              <button type="button" onClick={() => void load()} className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600 sm:mt-0">Tải lại</button>
            </div>
          </header>

          <section className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_190px]">
            <label className="text-sm font-semibold text-slate-700">Tìm vai trò hoặc quyền<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ví dụ: admin, task.view..." className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" /></label>
            <label className="text-sm font-semibold text-slate-700">Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="all">Tất cả</option><option value="active">Đang hoạt động</option><option value="inactive">Không hoạt động</option></select></label>
            <p className="text-sm text-slate-500 sm:col-span-2" aria-live="polite">{message} Hiển thị {visibleRoles.length}/{roles.length} vai trò.</p>
          </section>

          <div className="space-y-4">
            {visibleRoles.map((role) => <article key={role.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
                <div><h2 className="text-lg font-bold">{role.name}</h2><p className="text-xs text-slate-500">{role.code} · Cấp {role.level}</p></div>
                <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${role.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{role.active ? "ACTIVE" : "INACTIVE"}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {role.modules.map((module) => <section key={module.key} className="grid md:grid-cols-[180px_1fr]">
                  <div className="bg-orange-50/70 px-4 py-3 font-bold uppercase tracking-wide text-orange-900 sm:px-5">Mô-đun: {module.key}</div>
                  <div className="divide-y divide-slate-100">{module.permissions.map((permission) => <div key={permission.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(220px,1fr)_minmax(180px,0.8fr)] sm:px-5">
                    <div><p className="font-semibold text-slate-900">{permission.name}</p><p className="font-mono text-xs text-slate-500">Quyền: {permission.code}</p>{permission.description ? <p className="mt-1 text-xs text-slate-500">{permission.description}</p> : null}</div>
                    <div><p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Phạm vi</p><div className="flex flex-wrap gap-1.5">{permission.scopes.length > 0 ? permission.scopes.map((scope) => <span key={scope} className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-800 ring-1 ring-orange-200">{scopeLabels[scope] ?? scope}</span>) : <span className="text-xs italic text-slate-400">Không được cấp</span>}</div></div>
                  </div>)}</div>
                </section>)}
              </div>
            </article>)}
            {visibleRoles.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center text-sm text-slate-500">Không có vai trò phù hợp bộ lọc.</div> : null}
          </div>
        </div>
      </div>
    </main>
  );
}
