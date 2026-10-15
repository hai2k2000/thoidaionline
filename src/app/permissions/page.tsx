"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import type {
  OverrideEffect,
  PermissionManagementPayload,
  PermissionMatrixGrantRow,
  PermissionMatrixRole,
} from "@/lib/permissionMatrix";

type Scope = PermissionMatrixGrantRow["scope"];
type Payload = Partial<PermissionManagementPayload> & { roleCatalog?: PermissionMatrixRole[] };

const scopeLabels: Record<Scope, string> = {
  self: "Cá nhân",
  assigned: "Được giao / liên quan",
  department: "Phòng ban",
  all: "Toàn cơ quan",
};
const allScopes = Object.keys(scopeLabels) as Scope[];

function sourceLabel(source: string) {
  if (source === "role") return "Vai trò";
  if (source === "user_allow") return "Cấp riêng";
  if (source === "user_deny") return "Chặn riêng";
  return "Không có";
}

export default function PermissionsPage() {
  const router = useRouter();
  const { loading, user, logout } = useAuth();
  const [payload, setPayload] = useState<Payload>({});
  const [tab, setTab] = useState<"roles" | "users">("roles");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [roleDraft, setRoleDraft] = useState<Record<string, Scope[]>>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("Đang tải ma trận phân quyền...");

  const load = useCallback(async () => {
    const response = await fetch("/api/permissions", { cache: "no-store", credentials: "same-origin" });
    const next = await response.json().catch(() => ({})) as Payload;
    if (!response.ok) {
      setMessage("Không thể tải ma trận phân quyền.");
      if (response.status === 401) router.push("/login");
      if (response.status === 403) router.push("/");
      return;
    }
    setPayload(next);
    const nextRoles = next.roles ?? next.roleCatalog ?? [];
    if (!selectedRoleId && nextRoles[0]) setSelectedRoleId(nextRoles[0].id);
    if (!selectedUserId && next.users?.[0]) setSelectedUserId(next.users[0].id);
    setMessage("Quyền hiệu lực được tính theo deny > allow > role grant.");
  }, [router, selectedRoleId, selectedUserId]);

  useEffect(() => {
    if (loading) return;
    if (!user) return void router.push("/login");
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load, loading, router, user]);

  const roles = payload.roles ?? payload.roleCatalog ?? [];
  const users = useMemo(() => payload.users ?? [], [payload.users]);
  const selectedRole = roles.find((entry) => entry.id === selectedRoleId) ?? roles[0];
  const selectedUser = users.find((entry) => entry.id === selectedUserId) ?? users[0];
  const affectedCount = users.filter((entry) => entry.active && entry.role_id === selectedRole?.id).length;
  const filteredUsers = useMemo(() => {
    const needle = userQuery.trim().toLocaleLowerCase("vi");
    return users.filter((entry) => !needle || [entry.full_name, entry.username ?? ""].some((value) => value.toLocaleLowerCase("vi").includes(needle)));
  }, [userQuery, users]);

  useEffect(() => {
    if (!selectedRole) return;
    const next: Record<string, Scope[]> = {};
    for (const section of selectedRole.modules) {
      for (const permission of section.permissions) next[permission.code] = [...permission.scopes];
    }
    setRoleDraft(next);
  }, [selectedRole]);

  async function mutate(body: Record<string, unknown>) {
    setPending(true);
    try {
      const response = await fetch("/api/permissions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) await load();
      return response.ok;
    } finally {
      setPending(false);
    }
  }

  async function saveRole() {
    if (!selectedRole?.active) return;
    const grants = (payload.permissions ?? [])
      .map((permission) => ({ permissionCode: permission.code, scopes: roleDraft[permission.code] ?? [] }))
      .filter((grant) => grant.scopes.length > 0);
    const ok = await mutate({ action: "replace_role_permissions", roleId: selectedRole.id, grants });
    setMessage(ok ? "Đã lưu quyền cho vai trò." : "Không thể lưu quyền cho vai trò.");
  }

  async function updateOverride(permissionCode: string, effect: OverrideEffect, scope: Scope = "all") {
    if (!selectedUser) return;
    const body = effect === "inherit"
      ? { action: "clear_user_override", userId: selectedUser.id, permissionCode }
      : { action: "set_user_override", userId: selectedUser.id, permissionCode, effect, scope };
    const ok = await mutate(body);
    setMessage(ok ? "Đã cập nhật quyền riêng." : "Không thể cập nhật quyền riêng.");
  }

  async function restoreAllOverrides() {
    if (!selectedUser) return;
    const ok = await mutate({ action: "restore_user_inheritance", userId: selectedUser.id });
    setMessage(ok ? "Đã khôi phục toàn bộ quyền mặc định." : "Không thể khôi phục quyền mặc định.");
  }

  return (
    <main className="mobile-page-shell min-h-screen bg-[radial-gradient(circle_at_top_right,_#fff7ed,_#f8fafc_38%)] p-3 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-5">
        <div className="mb-4 lg:mb-0">
          <AppNav currentPath="/permissions" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} avatarUrl={user?.avatar_url} onLogout={logout} />
        </div>
        <div className="min-w-0">
          <header className="mb-4 overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 via-red-500 to-amber-400" />
            <div className="flex flex-wrap items-end justify-between gap-4 p-5">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">RBAC V2 · Quản trị quyền</p>
                <h1 className="mt-1 text-2xl font-bold">Cấu hình quyền</h1>
                <p className="mt-1 text-sm text-slate-600">{message}</p>
              </div>
              <button onClick={() => void load()} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white">Tải lại</button>
            </div>
          </header>

          <div className="mb-4 flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1" role="tablist">
            <button onClick={() => setTab("roles")} className={tab === "roles" ? "flex-1 rounded-lg bg-white px-3 py-2 text-sm font-bold shadow-sm" : "flex-1 px-3 py-2 text-sm font-bold text-slate-500"}>Theo vai trò</button>
            <button onClick={() => setTab("users")} className={tab === "users" ? "flex-1 rounded-lg bg-white px-3 py-2 text-sm font-bold shadow-sm" : "flex-1 px-3 py-2 text-sm font-bold text-slate-500"}>Theo người dùng</button>
          </div>

          {tab === "roles" ? (
            <section className="grid gap-4 lg:grid-cols-[250px_1fr]">
              <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <p className="px-2 pb-2 text-xs font-bold uppercase text-slate-500">Vai trò trong database</p>
                {roles.map((role) => <button key={role.id} onClick={() => setSelectedRoleId(role.id)} className={selectedRole?.id === role.id ? "mb-1 w-full rounded-xl bg-orange-50 px-3 py-3 text-left ring-1 ring-orange-300" : "mb-1 w-full rounded-xl px-3 py-3 text-left hover:bg-slate-50"}><b className="block">{role.name}</b><span className="font-mono text-xs text-slate-500">{role.code}</span>{!role.active ? <span className="block text-xs font-semibold text-amber-700">Không hoạt động</span> : null}</button>)}
              </aside>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold">{selectedRole?.name ?? "Chưa chọn vai trò"}</h2><p className="text-sm text-slate-500">{affectedCount} người dùng bị ảnh hưởng trước khi lưu</p></div><button disabled={!selectedRole?.active || pending} onClick={() => void saveRole()} className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Lưu thay đổi</button></div>
                {(payload.modules ?? []).map((module) => <div key={module.key} className="mb-5 overflow-hidden rounded-xl border border-slate-200"><div className="bg-slate-50 px-4 py-3 text-sm font-bold uppercase">{module.key}</div>{module.permissions.map((permission) => <div key={permission.code} className="grid gap-3 border-t border-slate-100 px-4 py-3 md:grid-cols-[1fr_auto]"><div><b>{permission.name}</b><p className="font-mono text-xs text-slate-500">{permission.code}</p><p className="text-xs text-slate-500">{permission.description}</p></div><div className="flex flex-wrap items-center justify-end gap-2">{(payload.scopeOptions?.[permission.code] ?? allScopes).map((scope) => <label key={scope} className="flex items-center gap-1 text-xs"><input type="checkbox" disabled={!selectedRole?.active} checked={(roleDraft[permission.code] ?? []).includes(scope)} onChange={() => setRoleDraft((draft) => { const current = draft[permission.code] ?? []; return { ...draft, [permission.code]: current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope] }; })} />{scopeLabels[scope]}</label>)}</div></div>)}</div>)}
              </div>
            </section>
          ) : (
            <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="text-sm font-semibold">Tìm người dùng<input aria-label="Tìm người dùng" value={userQuery} onChange={(event) => setUserQuery(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
                <div className="mt-3 max-h-[520px] space-y-1 overflow-y-auto">{filteredUsers.map((entry) => <button key={entry.id} onClick={() => setSelectedUserId(entry.id)} className={selectedUser?.id === entry.id ? "w-full rounded-xl bg-orange-50 px-3 py-3 text-left ring-1 ring-orange-300" : "w-full rounded-xl px-3 py-3 text-left hover:bg-slate-50"}><b className="block">{entry.full_name}</b><span className="text-xs text-slate-500">{entry.active ? "Đang hoạt động" : "Không hoạt động"}</span></button>)}</div>
              </aside>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                {selectedUser ? <><div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4"><div><h2 className="text-xl font-bold">{selectedUser.full_name}</h2><p className="text-sm text-slate-600">{selectedUser.roles && !Array.isArray(selectedUser.roles) ? selectedUser.roles.name : "Chưa có vai trò"} · {selectedUser.department_name ?? "Chưa có phòng ban"} · {selectedUser.active ? "Đang hoạt động" : "Không hoạt động"}</p></div><button disabled={pending} onClick={() => void restoreAllOverrides()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Khôi phục tất cả mặc định</button></div>{(payload.modules ?? []).map((module) => <div key={module.key} className="mb-5 overflow-hidden rounded-xl border border-slate-200"><div className="bg-slate-50 px-4 py-3 text-sm font-bold uppercase">{module.key}</div>{module.permissions.map((permission) => { const override = selectedUser.overrides[permission.code]; const effective = selectedUser.effective[permission.code]; const state: OverrideEffect = override?.effect ?? "inherit"; const explicitEffect = state === "allow" || state === "deny" ? state : null; return <div key={permission.code} className="grid gap-3 border-t border-slate-100 px-4 py-3 md:grid-cols-[1fr_auto]"><div><b>{permission.name}</b><p className="font-mono text-xs text-slate-500">{permission.code}</p><p className="mt-1 text-xs">Mặc định: {effective.roleScopes.length ? effective.roleScopes.map((scope) => scopeLabels[scope]).join(", ") : "Không có"}</p><p className="text-xs font-semibold">Hiệu lực: {effective.scopes.length ? effective.scopes.map((scope) => scopeLabels[scope]).join(", ") : "Không có"} · {sourceLabel(effective.source)}</p></div><div className="flex flex-wrap items-center justify-end gap-2"><select value={state} onChange={(event) => void updateOverride(permission.code, event.target.value as OverrideEffect, override?.scope ?? "all")} className="rounded-lg border border-slate-300 px-2 py-2 text-xs"><option value="inherit">Kế thừa</option><option value="allow">Cấp riêng</option><option value="deny">Chặn riêng</option></select>{explicitEffect ? <select disabled={!selectedUser.active || explicitEffect === "deny"} value={override?.scope ?? "all"} onChange={(event) => void updateOverride(permission.code, explicitEffect, event.target.value as Scope)} className="rounded-lg border border-slate-300 px-2 py-2 text-xs">{(payload.scopeOptions?.[permission.code] ?? allScopes).map((scope) => <option key={scope} value={scope}>{scopeLabels[scope]}</option>)}</select> : null}<button disabled={pending || !override} onClick={() => void updateOverride(permission.code, "inherit")} className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-semibold">Khôi phục</button></div></div>; })}</div>)}</> : <p>Chưa chọn người dùng.</p>}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
