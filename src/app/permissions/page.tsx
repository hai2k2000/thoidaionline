"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import type { PermissionMatrixRole, QuickReportUserPermission } from "@/lib/permissionMatrix";

const scopeLabels: Record<string, string> = {
  self: "Cá nhân",
  assigned: "Được giao / liên quan",
  department: "Phòng ban",
  all: "Toàn cơ quan",
};

const moduleLabels: Record<string, string> = { task: "Công việc", permission: "Phân quyền" };
const QUICK_REPORT_CODE = "task.quick_report.create";
const QUICK_REPORT_NAME = "Tạo/Báo cáo công việc phát sinh";
const QUICK_REPORT_DESCRIPTION = "Cho phép tạo công việc phát sinh không cần phê duyệt, bao gồm tạo một việc hoặc nhiều việc cùng lúc.";
const QUICK_REPORT_REVOKE_CONFIRMATION = "Thu hồi quyền Tạo/Báo cáo công việc phát sinh?";
type PermissionPayload = { roles?: PermissionMatrixRole[]; users?: QuickReportUserPermission[] };

export default function PermissionsPage() {
  const router = useRouter();
  const { loading: authLoading, user, logout } = useAuth();
  const [roles, setRoles] = useState<PermissionMatrixRole[]>([]);
  const [users, setUsers] = useState<QuickReportUserPermission[]>([]);
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [query, setQuery] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [message, setMessage] = useState("Đang tải ma trận phân quyền...");
  const [pendingRoleId, setPendingRoleId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setMessage("Đang tải ma trận phân quyền...");
    const response = await fetch("/api/permissions", { cache: "no-store", credentials: "same-origin" });
    const payload = await response.json().catch(() => ({})) as PermissionPayload;
    if (!response.ok) {
      setMessage("Không thể tải ma trận phân quyền.");
      if (response.status === 401) router.push("/login");
      if (response.status === 403) router.push("/");
      return;
    }
    setRoles(payload.roles ?? []);
    setUsers(payload.users ?? []);
    setMessage("Có thể quản lý quyền Quick Report theo vai trò hoặc trực tiếp theo người dùng.");
  }, [router]);

  const setQuickReportPermission = useCallback(async (roleId: string, granted: boolean) => {
    if (!granted && !window.confirm(QUICK_REPORT_REVOKE_CONFIRMATION)) return;
    setPendingRoleId(roleId);
    const response = await fetch("/api/permissions", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roleId, action: granted ? "grant" : "revoke" }),
    });
    if (!response.ok) {
      setMessage(response.status === 403 ? "Bạn không có quyền thay đổi phân quyền." : "Không thể cập nhật quyền.");
      setPendingRoleId(null);
      return;
    }
    await load();
    setPendingRoleId(null);
  }, [load]);

  const setQuickReportPermissionForUser = useCallback(async (entry: QuickReportUserPermission) => {
    if (entry.directGranted && !window.confirm(QUICK_REPORT_REVOKE_CONFIRMATION)) return;
    setPendingRoleId(entry.id);
    const response = await fetch("/api/permissions", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: entry.id, action: entry.directGranted ? "revoke" : "grant" }),
    });
    if (!response.ok) {
      setMessage(response.status === 403 ? "Bạn không có quyền thay đổi phân quyền." : "Không thể cập nhật quyền.");
      setPendingRoleId(null);
      return;
    }
    await load();
    setPendingRoleId(null);
  }, [load]);

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

  const visibleUsers = useMemo(() => {
    const needle = userQuery.normalize("NFC").trim().toLocaleLowerCase("vi");
    return users.filter((entry) => !needle || [entry.fullName, entry.username ?? "", entry.roleCode, entry.roleName]
      .some((value) => value.toLocaleLowerCase("vi").includes(needle)));
  }, [userQuery, users]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#fff7ed,_#f8fafc_38%)] p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-5">
        <div className="mb-4 lg:mb-0"><AppNav currentPath="/permissions" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} avatarUrl={user?.avatar_url} onLogout={logout} /></div>
        <div className="min-w-0">
          <header className="mb-5 overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 via-red-500 to-amber-400" />
            <div className="p-5 sm:flex sm:items-end sm:justify-between sm:gap-6">
              <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">RBAC · Quản trị quyền</p><h1 className="mt-1 text-2xl font-bold">Ma trận phân quyền</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Vai trò → Mô-đun → Quyền → Phạm vi. Admin có thể cấp hoặc thu hồi quyền báo cáo việc phát sinh theo vai trò.</p></div>
              <button type="button" onClick={() => void load()} className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600 sm:mt-0">Tải lại</button>
            </div>
          </header>

          <section className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_190px]">
            <label className="text-sm font-semibold text-slate-700">Tìm vai trò hoặc quyền<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ví dụ: admin, task.view..." className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" /></label>
            <label className="text-sm font-semibold text-slate-700">Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="all">Tất cả</option><option value="active">Đang hoạt động</option><option value="inactive">Không hoạt động</option></select></label>
            <p className="text-sm text-slate-500 sm:col-span-2" aria-live="polite">{message} Hiển thị {visibleRoles.length}/{roles.length} vai trò.</p>
          </section>

          <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
              <h2 className="text-lg font-bold">Quyền theo người dùng</h2>
              <p className="mt-1 text-sm text-slate-600">Nguồn quyền: vai trò, trực tiếp hoặc hiệu lực kết hợp.</p>
              <input aria-label="Tìm người dùng" value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="Tìm người dùng, tài khoản hoặc vai trò..." className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
            </div>
            <div className="divide-y divide-slate-100">
              {visibleUsers.map((entry) => (
                <div key={entry.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto] sm:items-center sm:px-5">
                  <div><p className="font-semibold">{entry.fullName}</p><p className="font-mono text-xs text-slate-500">{entry.username ?? "—"} · {entry.roleName || entry.roleCode || "Chưa có vai trò"}</p></div>
                  <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                    <span className={entry.roleGranted ? "rounded-full bg-blue-100 px-2.5 py-1 text-blue-800" : "rounded-full bg-slate-100 px-2.5 py-1 text-slate-500"}>Vai trò: {entry.roleGranted ? "Có" : "Không"}</span>
                    <span className={entry.directGranted ? "rounded-full bg-orange-100 px-2.5 py-1 text-orange-800" : "rounded-full bg-slate-100 px-2.5 py-1 text-slate-500"}>Trực tiếp: {entry.directGranted ? "Có" : "Không"}</span>
                    <span className={entry.effective ? "rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800" : "rounded-full bg-slate-100 px-2.5 py-1 text-slate-500"}>Hiệu lực: {entry.effective ? "Có" : "Không"}</span>
                  </div>
                  <button type="button" disabled={pendingRoleId === entry.id} onClick={() => void setQuickReportPermissionForUser(entry)} className={entry.directGranted ? "rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60" : "rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"}>{entry.directGranted ? "Thu hồi trực tiếp" : "Cấp trực tiếp"}</button>
                </div>
              ))}
              {visibleUsers.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-500">Không có người dùng phù hợp.</p> : null}
            </div>
          </section>

          <div className="space-y-4">
            {visibleRoles.map((role) => <article key={role.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
                <div><h2 className="text-lg font-bold">{role.name}</h2><p className="text-xs text-slate-500">{role.code} · Cấp {role.level}</p></div>
                <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${role.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{role.active ? "ACTIVE" : "INACTIVE"}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {role.modules.map((module) => <section key={module.key} className="grid md:grid-cols-[180px_1fr]">
                  <div className="bg-orange-50/70 px-4 py-3 font-bold uppercase tracking-wide text-orange-900 sm:px-5">Mô-đun: {moduleLabels[module.key] ?? module.key}</div>
                  <div className="divide-y divide-slate-100">{module.permissions.map((permission) => <div key={permission.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(220px,1fr)_minmax(180px,0.8fr)] sm:px-5">
                    <div><p className="font-semibold text-slate-900">{permission.code === QUICK_REPORT_CODE ? QUICK_REPORT_NAME : permission.name}</p><p className="font-mono text-xs text-slate-500">Quyền: {permission.code}</p>{permission.code === QUICK_REPORT_CODE ? <p className="mt-1 text-xs text-slate-500">{QUICK_REPORT_DESCRIPTION}</p> : permission.description ? <p className="mt-1 text-xs text-slate-500">{permission.description}</p> : null}</div>
                    <div><p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Phạm vi</p><div className="flex flex-wrap items-center gap-1.5">{permission.scopes.length > 0 ? permission.scopes.map((scope) => <span key={scope} className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-800 ring-1 ring-orange-200">{scopeLabels[scope] ?? scope}</span>) : <span className="text-xs italic text-slate-400">Không được cấp</span>}{permission.code === QUICK_REPORT_CODE ? (() => { const granted = permission.scopes.includes("all"); return <button type="button" disabled={pendingRoleId === role.id} onClick={() => void setQuickReportPermission(role.id, !granted)} className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white transition disabled:cursor-wait disabled:opacity-60 ${granted ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>{granted ? "Thu hồi" : "Cấp quyền"}</button>; })() : null}</div></div>
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
