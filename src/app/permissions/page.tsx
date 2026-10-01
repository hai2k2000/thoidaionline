"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import type { PermissionMatrixRole, QuickReportUserPermission } from "@/lib/permissionMatrix";

const scopeLabels: Record<string, string> = { self: "Cá nhân", assigned: "Được giao / liên quan", department: "Phòng ban", all: "Toàn cơ quan" };
const QUICK_REPORT_CODE = "task.quick_report.create";
const QUICK_REPORT_NAME = "Tạo/Báo cáo công việc phát sinh";
const QUICK_REPORT_DESCRIPTION = "Cho phép tạo công việc phát sinh không cần phê duyệt, bao gồm tạo một việc hoặc nhiều việc cùng lúc.";
const QUICK_REPORT_REVOKE_CONFIRMATION = "Thu hồi quyền Tạo/Báo cáo công việc phát sinh?";
const USERS_PER_PAGE = 25;
type PermissionPayload = { roles?: PermissionMatrixRole[]; users?: QuickReportUserPermission[] };
type UserFilter = "effective" | "none" | "direct" | "role" | "all";
type Tab = "users" | "roles";

function SourceMark({ active, label }: { active: boolean; label: string }) {
  return <span className={active ? "inline-flex items-center gap-1 text-xs font-bold text-emerald-700" : "inline-flex items-center gap-1 text-xs text-slate-400"}><span aria-hidden="true">{active ? "✓" : "—"}</span>{label}</span>;
}

export default function PermissionsPage() {
  const router = useRouter();
  const { loading: authLoading, user, logout } = useAuth();
  const [roles, setRoles] = useState<PermissionMatrixRole[]>([]);
  const [users, setUsers] = useState<QuickReportUserPermission[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [effectiveOnly, setEffectiveOnly] = useState(true);
  const [userFilter, setUserFilter] = useState<UserFilter>("effective");
  const [userQuery, setUserQuery] = useState("");
  const [currentUserPage, setCurrentUserPage] = useState(1);
  const [showDetails, setShowDetails] = useState(false);
  const [message, setMessage] = useState("Đang tải ma trận phân quyền...");
  const [pendingId, setPendingId] = useState<string | null>(null);

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
    setMessage("Có thể quản lý quyền theo vai trò hoặc trực tiếp theo người dùng.");
  }, [router]);

  const setQuickReportPermission = useCallback(async (id: string, kind: "role" | "user", granted: boolean) => {
    if (!granted && !window.confirm(QUICK_REPORT_REVOKE_CONFIRMATION)) return;
    setPendingId(id);
    const response = await fetch("/api/permissions", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(kind === "role" ? { roleId: id, action: granted ? "grant" : "revoke" } : { userId: id, action: granted ? "grant" : "revoke" }),
    });
    if (!response.ok) {
      setMessage(response.status === 403 ? "Bạn không có quyền thay đổi phân quyền." : "Không thể cập nhật quyền.");
      setPendingId(null);
      return;
    }
    await load();
    setPendingId(null);
  }, [load]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [authLoading, load, router, user]);

  const selectedPermission = useMemo(() => ({ code: QUICK_REPORT_CODE, name: QUICK_REPORT_NAME, module: "Công việc", description: QUICK_REPORT_DESCRIPTION }), []);
  const summary = useMemo(() => ({
    effective: users.filter((entry) => entry.effective).length,
    direct: users.filter((entry) => entry.directGranted).length,
    role: users.filter((entry) => entry.roleGranted).length,
  }), [users]);

  const filteredUsers = useMemo(() => {
    const needle = userQuery.normalize("NFC").trim().toLocaleLowerCase("vi");
    return users.filter((entry) => {
      const matchesSearch = !needle || [entry.fullName, entry.username ?? "", entry.roleCode, entry.roleName].some((value) => value.toLocaleLowerCase("vi").includes(needle));
      if (!matchesSearch || (effectiveOnly && !entry.effective)) return false;
      if (userFilter === "effective" && !entry.effective) return false;
      if (userFilter === "none" && entry.effective) return false;
      if (userFilter === "direct" && !entry.directGranted) return false;
      if (userFilter === "role" && !entry.roleGranted) return false;
      return true;
    });
  }, [effectiveOnly, userFilter, userQuery, users]);

  const userPageCount = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const safeUserPage = Math.min(currentUserPage, userPageCount);
  const pagedUsers = filteredUsers.slice((safeUserPage - 1) * USERS_PER_PAGE, safeUserPage * USERS_PER_PAGE);


  const roleRows = useMemo(() => roles.map((role) => {
    const permission = role.modules.flatMap((module) => module.permissions).find((entry) => entry.code === selectedPermission.code);
    return { ...role, granted: permission?.scopes.includes("all") ?? false, scope: permission?.scopes[0] ?? null, userCount: users.filter((entry) => entry.roleCode === role.code).length };
  }), [roles, selectedPermission.code, users]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#fff7ed,_#f8fafc_38%)] p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-5">
        <div className="mb-4 lg:mb-0"><AppNav currentPath="/permissions" userLabel={(user?.full_name ?? "") + " (" + (user?.role_name ?? "") + ")"} avatarUrl={user?.avatar_url} onLogout={logout} /></div>
        <div className="min-w-0">
          <header className="mb-4 overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 via-red-500 to-amber-400" />
            <div className="flex flex-wrap items-end justify-between gap-4 p-5">
              <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">RBAC · Quản trị quyền</p><h1 className="mt-1 text-2xl font-bold">Cấu hình quyền</h1><p className="mt-1 text-sm text-slate-600">{message}</p></div>
              <button type="button" onClick={() => void load()} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600">Tải lại</button>
            </div>
          </header>

          <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-700">{selectedPermission.module}</p><h2 className="mt-1 text-xl font-bold">{selectedPermission.name}</h2><p className="font-mono text-xs text-slate-500">{selectedPermission.code}</p></div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl bg-emerald-50 px-3 py-2"><b className="block text-lg text-emerald-700">{summary.effective}</b>Có quyền</div><div className="rounded-xl bg-orange-50 px-3 py-2"><b className="block text-lg text-orange-700">{summary.direct}</b>Cấp trực tiếp</div><div className="rounded-xl bg-blue-50 px-3 py-2"><b className="block text-lg text-blue-700">{summary.role}</b>Qua vai trò</div></div>
            </div>
            {showDetails ? <p className="mt-3 max-w-3xl text-sm text-slate-600">{selectedPermission.description}</p> : null}
            <button type="button" onClick={() => setShowDetails((value) => !value)} className="mt-3 text-xs font-bold text-orange-700 hover:text-orange-800">{showDetails ? "Ẩn chi tiết quyền" : "Chi tiết quyền"}</button>
          </section>

          <div className="mb-4 flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1" role="tablist" aria-label="Phạm vi cấu hình">
            <button type="button" role="tab" aria-selected={activeTab === "users"} onClick={() => setActiveTab("users")} className={activeTab === "users" ? "flex-1 rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-sm" : "flex-1 rounded-lg px-3 py-2 text-sm font-bold text-slate-500 hover:text-slate-800"}>Theo người dùng</button>
            <button type="button" role="tab" aria-selected={activeTab === "roles"} onClick={() => setActiveTab("roles")} className={activeTab === "roles" ? "flex-1 rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-sm" : "flex-1 rounded-lg px-3 py-2 text-sm font-bold text-slate-500 hover:text-slate-800"}>Theo vai trò</button>
          </div>

          {activeTab === "users" ? <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
              <label className="min-w-[220px] flex-1 text-sm font-semibold text-slate-700">Tìm người dùng<input aria-label="Tìm người dùng" value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="Tìm người dùng..." className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" /></label>
              <button type="button" onClick={() => setEffectiveOnly((value) => !value)} className="rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm font-bold text-orange-700">{effectiveOnly ? "Hiện tất cả người dùng" : "Chỉ hiện người có quyền"}</button>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
              {([["effective", "Đang có quyền"], ["none", "Chưa có quyền"], ["direct", "Cấp trực tiếp"], ["role", "Qua vai trò"], ["all", "Tất cả"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => { setUserFilter(value); setEffectiveOnly(value === "effective"); }} className={userFilter === value ? "rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white" : "rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200"}>{label}</button>)}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-bold sm:px-5">Người dùng</th><th className="px-4 py-3 font-bold">Vai trò</th><th className="px-4 py-3 font-bold">Trực tiếp</th><th className="px-4 py-3 font-bold">Hiệu lực</th><th className="px-4 py-3 font-bold">Thao tác</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedUsers.map((entry) => <tr key={entry.id} className="hover:bg-orange-50/40"><td className="px-4 py-2.5 sm:px-5"><p className="font-semibold">{entry.fullName}</p><p className="font-mono text-xs text-slate-500">{entry.username ?? "—"}</p></td><td className="px-4 py-2.5">{entry.roleName || entry.roleCode || "Chưa có vai trò"}</td><td className="px-4 py-2.5"><SourceMark active={entry.directGranted} label={entry.directGranted ? "Có" : "—"} /></td><td className="px-4 py-2.5"><SourceMark active={entry.effective} label={entry.effective ? "Có" : "—"} /></td><td className="px-4 py-2.5"><button type="button" disabled={pendingId === entry.id} onClick={() => void setQuickReportPermission(entry.id, "user", !entry.directGranted)} className={entry.directGranted ? "rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60" : "rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"}>{entry.directGranted ? "Thu hồi trực tiếp" : "Cấp trực tiếp"}</button></td></tr>)}
                </tbody>
              </table>
            </div>
            {pagedUsers.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-500">Không có người dùng phù hợp.</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500 sm:px-5"><span>Hiển thị {filteredUsers.length === 0 ? 0 : (safeUserPage - 1) * USERS_PER_PAGE + 1}–{Math.min(safeUserPage * USERS_PER_PAGE, filteredUsers.length)} / {filteredUsers.length}</span><div className="flex items-center gap-2"><button type="button" disabled={safeUserPage <= 1} onClick={() => setCurrentUserPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-slate-300 px-3 py-1.5 font-bold disabled:opacity-40">Trước</button><span>Trang {safeUserPage}/{userPageCount}</span><button type="button" disabled={safeUserPage >= userPageCount} onClick={() => setCurrentUserPage((page) => Math.min(userPageCount, page + 1))} className="rounded-lg border border-slate-300 px-3 py-1.5 font-bold disabled:opacity-40">Sau</button></div></div>
          </section> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-bold sm:px-5">Vai trò</th><th className="px-4 py-3 font-bold">Được cấp</th><th className="px-4 py-3 font-bold">Số người dùng</th><th className="px-4 py-3 font-bold">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{roleRows.map((role) => <tr key={role.id} className="hover:bg-orange-50/40"><td className="px-4 py-2.5 sm:px-5"><p className="font-semibold">{role.name}</p><p className="font-mono text-xs text-slate-500">{role.code}</p></td><td className="px-4 py-2.5">{role.granted ? <span className="font-bold text-emerald-700">Có{role.scope ? " · " + (scopeLabels[role.scope] ?? role.scope) : ""}</span> : <span className="text-slate-400">—</span>}</td><td className="px-4 py-2.5">{role.userCount}</td><td className="px-4 py-2.5">{role.active ? <button type="button" disabled={pendingId === role.id} onClick={() => void setQuickReportPermission(role.id, "role", !role.granted)} className={role.granted ? "rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60" : "rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"}>{role.granted ? "Thu hồi" : "Cấp quyền"}</button> : <span className="text-xs text-slate-400">Không hoạt động</span>}</td></tr>)}</tbody></table></div>
            {roleRows.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-500">Không có vai trò.</p> : null}
          </section>}
        </div>
      </div>
    </main>
  );
}
