"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import UserPermissionPanel from "@/components/permissions/UserPermissionPanel";
import type { PermissionManagementPayload, PermissionMatrixGrantRow, PermissionMatrixRole, } from "@/lib/permissionMatrix";
import { groupPermissions } from "@/lib/approvalPermissionView.mjs";
type Scope = PermissionMatrixGrantRow["scope"];
type Payload = Partial<PermissionManagementPayload> & {
    roleCatalog?: PermissionMatrixRole[];
};
const scopeLabels: Record<Scope, string> = {
    self: "Cá nhân",
    assigned: "Được giao / liên quan",
    department: "Phòng ban",
    all: "Toàn cơ quan",
};
const allScopes = Object.keys(scopeLabels) as Scope[];
export default function PermissionsPage() {
    const router = useRouter();
    const { loading, user, logout } = useAuth();
    const [payload, setPayload] = useState<Payload>({});
    const [tab, setTab] = useState<"roles" | "users">("roles");
    const [selectedRoleId, setSelectedRoleId] = useState("");
    const [selectedUserId, setSelectedUserId] = useState("");
    const [roleDraft, setRoleDraft] = useState<Record<string, Scope[]>>({});
    const [pending, setPending] = useState(false);
    const [permissionSearch, setPermissionSearch] = useState("");
    const [message, setMessage] = useState("Đang tải ma trận phân quyền...");
    const load = useCallback(async (silent = false) => {
        const response = await fetch("/api/permissions", { cache: "no-store", credentials: "same-origin" });
        const next = await response.json().catch(() => ({})) as Payload;
        if (!response.ok) {
            setMessage("Không thể tải ma trận phân quyền.");
            if (response.status === 401)
                router.push("/login");
            if (response.status === 403)
                router.push("/");
            return;
        }
        setPayload(next);
        const nextRoles = next.roles ?? next.roleCatalog ?? [];
        if (!selectedRoleId && nextRoles[0])
            setSelectedRoleId(nextRoles[0].id);
        if (!silent) setMessage("Quyền hiệu lực được tính theo deny > allow > role grant.");
    }, [router, selectedRoleId]);
    useEffect(() => {
        if (loading)
            return;
        if (!user)
            return void router.push("/login");
        const timer = setTimeout(() => void load(), 0);
        return () => clearTimeout(timer);
    }, [load, loading, router, user]);
    const roles = payload.roles ?? payload.roleCatalog ?? [];
    const users = useMemo(() => payload.users ?? [], [payload.users]);
    const selectedRole = roles.find((entry) => entry.id === selectedRoleId) ?? roles[0];
    const rolePermissions = (payload.modules ?? []).flatMap((module) => module.permissions);
    const roleGroups = groupPermissions(rolePermissions as never) as Array<{
        key: string;
        label: string;
        permissions: Array<{ code: string; name?: string; description?: string | null }>;
    }>;
    const affectedCount = users.filter((entry) => entry.active && entry.role_id === selectedRole?.id).length;
    useEffect(() => {
        if (!selectedRole)
            return;
        const next: Record<string, Scope[]> = {};
        for (const section of selectedRole.modules) {
            for (const permission of section.permissions)
                next[permission.code] = [...permission.scopes];
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
            if (response.ok)
                await load(true);
            return response.ok;
        }
        finally {
            setPending(false);
        }
    }
    async function saveRole() {
        if (!selectedRole?.active)
            return;
        const grants = (payload.permissions ?? [])
            .map((permission) => ({ permissionCode: permission.code, scopes: roleDraft[permission.code] ?? [] }))
            .filter((grant) => grant.scopes.length > 0);
        const ok = await mutate({ action: "replace_role_permissions", roleId: selectedRole.id, grants });
        setMessage(ok ? "Đã lưu quyền cho vai trò." : "Không thể lưu quyền cho vai trò.");
    }
    return (<main className="mobile-page-shell min-h-screen bg-[radial-gradient(circle_at_top_right,_#fff7ed,_#f8fafc_38%)] p-3 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-5">
        <div className="mb-4 lg:mb-0">
          <AppNav currentPath="/permissions" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} avatarUrl={user?.avatar_url} onLogout={logout}/>
        </div>
        <div className="min-w-0">
          <header className="mb-4 overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 via-red-500 to-amber-400"/>
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
            <button onClick={() => setTab("roles")}
  className={tab === "roles" ? "flex-1 rounded-lg bg-white px-3 py-2 text-sm font-bold shadow-sm" : "flex-1 px-3 py-2 text-sm font-bold text-slate-500"}>
              Theo vai trò
            </button>
            <button onClick={() => setTab("users")}
  className={tab === "users" ? "flex-1 rounded-lg bg-white px-3 py-2 text-sm font-bold shadow-sm" : "flex-1 px-3 py-2 text-sm font-bold text-slate-500"}>
              Theo người dùng
            </button>
          </div>

          {tab === "roles" ? (<section className="grid gap-4 lg:grid-cols-[250px_1fr]">
              <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <p className="px-2 pb-2 text-xs font-bold uppercase text-slate-500">Vai trò trong database</p>
                {roles.map((role) => (<button key={role.id} onClick={() => setSelectedRoleId(role.id)} className={selectedRole?.id === role.id
                    ? "mb-1 w-full rounded-xl bg-orange-50 px-3 py-3 text-left ring-1 ring-orange-300"
                    : "mb-1 w-full rounded-xl px-3 py-3 text-left hover:bg-slate-50"}>
                    <b className="block">{role.name}</b>
                    <span className="font-mono text-xs text-slate-500">{role.code}</span>
                    {!role.active ? <span className="block text-xs font-semibold text-amber-700">Không hoạt động</span> : null}
                  </button>))}
              </aside>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">{selectedRole?.name ?? "Chưa chọn vai trò"}</h2>
                    <p className="text-sm text-slate-500">{affectedCount} người dùng bị ảnh hưởng trước khi lưu</p>
                  </div>
                  <button disabled={!selectedRole?.active || pending} onClick={() => void saveRole()} className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                    Lưu thay đổi
                  </button>
                </div>
                <input aria-label="Tìm quyền" placeholder="Tìm quyền" value={permissionSearch}
                  onChange={(event) => setPermissionSearch(event.target.value)} className="mb-4 w-full rounded-lg border px-3 py-2" />
                {roleGroups.map((group) => (<details key={group.key} open={Boolean(permissionSearch)}
                  className="mb-3 overflow-hidden rounded-xl border border-slate-200">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-bold">{group.label}
                      <span className="font-normal text-slate-500"> ({group.permissions.length}) · {group.permissions.filter((permission: { code: string }) =>
                        (roleDraft[permission.code] ?? []).length > 0).length}/{group.permissions.length} quyền</span>
                    </summary>
                    {group.permissions.filter((permission: { code: string; name?: string }) =>
                      `${permission.name} ${permission.code}`.toLowerCase().includes(permissionSearch.toLowerCase())).map((permission: {
                        code: string; name?: string; description?: string | null;
                    }) => (
                      <div key={permission.code} className="grid gap-3 border-t border-slate-100 px-4 py-3 md:grid-cols-[1fr_auto]">
                        <div>
                          <b>{permission.name}</b>
                          <p className="font-mono text-xs text-slate-500">{permission.code}</p>
                          <p className="text-xs text-slate-500">{permission.description}</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {(payload.scopeOptions?.[permission.code] ?? allScopes).map((scope) => (<label key={scope} className="flex items-center gap-1 text-xs">
                              <input type="checkbox" disabled={!selectedRole?.active} checked={(roleDraft[permission.code] ?? []).includes(scope)} onChange={() => setRoleDraft((draft) => {
                            const current = draft[permission.code] ?? [];
                            return {
                                ...draft,
                                [permission.code]: current.includes(scope)
                                    ? current.filter((item) => item !== scope)
                                    : [...current, scope],
                            };
                        })}/>
                              {scopeLabels[scope]}
                            </label>))}
                        </div>
                  </div>))}
                  </details>))}
              </div>
            </section>) : <UserPermissionPanel users={users.map((entry) => ({
                ...entry,
                role_name: Array.isArray(entry.roles) ? entry.roles[0]?.name : entry.roles?.name,
                role_code: Array.isArray(entry.roles) ? entry.roles[0]?.code : entry.roles?.code,
            }))} selectedUserId={selectedUserId} onSelect={setSelectedUserId} currentUserId={user?.id} onChanged={() => void load(true)} onToast={setMessage} genericModules={payload.modules}
  scopeOptions={payload.scopeOptions}/>}
        </div>
      </div>
    </main>);
}

