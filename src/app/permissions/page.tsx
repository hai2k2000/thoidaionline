"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import AppNav from "@/components/AppNav";
import { errorMessage, responseErrorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";

type PermissionKey = "can_manage_users" | "can_manage_permissions" | "can_create_task" | "can_edit_all_tasks" | "can_comment";
type PermissionRow = {
  role_id: string;
  can_manage_users: boolean;
  can_manage_permissions: boolean;
  can_create_task: boolean;
  can_edit_all_tasks: boolean;
  can_comment: boolean;
  roles?: { id: string; code: string; name: string; level: number; active: boolean } | null;
};

const columns: Array<{ key: PermissionKey; label: string }> = [
  { key: "can_manage_users", label: "Quản lý người dùng" },
  { key: "can_manage_permissions", label: "Quản lý phân quyền" },
  { key: "can_create_task", label: "Tạo công việc" },
  { key: "can_edit_all_tasks", label: "Sửa mọi công việc" },
  { key: "can_comment", label: "Bình luận" },
];

export default function PermissionsPage() {
  const router = useRouter();
  const { loading: authLoading, user, logout } = useAuth();
  const { notify } = useActionFeedback();
  const [busyPermission, setBusyPermission] = useState(false);
  const [rows, setRows] = useState<PermissionRow[]>([]);
  const [canRename, setCanRename] = useState(false);
  const [message, setMessage] = useState("Đang tải dữ liệu phân quyền...");
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "locked" | "all">("active");
  const [newRole, setNewRole] = useState({ code: "", name: "", level: 1 });
  const [creatingRole, setCreatingRole] = useState(false);

  const load = useCallback(async () => {
    setMessage("Đang tải dữ liệu phân quyền...");
    const response = await fetch(`/api/permissions?status=${statusFilter}`, { cache: "no-store", credentials: "same-origin" });
    const payload = await response.json().catch(() => ({})) as { error?: string; permissions?: PermissionRow[]; can_rename?: boolean };
    if (!response.ok) {
      setMessage(payload.error ?? "Không thể tải dữ liệu phân quyền.");
      if (response.status === 401 || response.status === 403) router.push("/");
      return;
    }
    setRows(payload.permissions ?? []);
    setCanRename(payload.can_rename === true);
    setMessage("Đã tải dữ liệu phân quyền.");
  }, [router, statusFilter]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [authLoading, user, router, load]);

  const beginEdit = (row: PermissionRow) => {
    if (!canRename || !row.roles) return;
    setEditingRoleId(row.role_id);
    setEditingName(row.roles.name);
    setMessage("Đang chỉnh sửa tên vai trò.");
  };

  const saveName = async (roleId: string) => {
    if (savingRoleId) return;
    setSavingRoleId(roleId);
    try { const response = await fetch("/api/permissions", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role_id: roleId, name: editingName }),
    });
    if (!response.ok) throw new Error(await responseErrorMessage(response, "Không thể cập nhật tên vai trò."));
    const payload = await response.json().catch(() => ({})) as { role?: { id: string; name: string } };
    setRows((previous) => previous.map((row) => row.role_id === roleId && row.roles && payload.role
      ? { ...row, roles: { ...row.roles, name: payload.role.name } }
      : row));
    setEditingRoleId(null);
    notify("success", "Đã cập nhật tên vai trò."); setMessage("Đã cập nhật tên vai trò.");
    } catch (error) { notify("error", errorMessage(error, "Không thể cập nhật tên vai trò.")); }
    finally { setSavingRoleId(null); }
  };

  const updatePermission = async (roleId: string, field: PermissionKey, value: boolean) => {
    if (busyPermission) return;
    setBusyPermission(true);
    try { const response = await fetch("/api/permissions", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role_id: roleId, permission: field, value }),
    });
    if (!response.ok) throw new Error(await responseErrorMessage(response, "Không thể cập nhật quyền vai trò."));
    setRows((previous) => previous.map((row) => row.role_id === roleId ? { ...row, [field]: value } : row));
    notify("success", "Đã cập nhật quyền vai trò."); setMessage("Đã cập nhật quyền vai trò.");
    } catch (error) { notify("error", errorMessage(error, "Không thể cập nhật quyền vai trò.")); }
    finally { setBusyPermission(false); }
  };

  const createRole = async () => {
    if (creatingRole) return;
    setCreatingRole(true);
    try {
      const response = await fetch("/api/permissions", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newRole) });
      if (!response.ok) throw new Error(await responseErrorMessage(response, "Không thể thêm vai trò."));
      setNewRole({ code: "", name: "", level: 1 });
      await load();
      notify("success", "Đã thêm vai trò mới.");
    } catch (error) { notify("error", errorMessage(error, "Không thể thêm vai trò.")); }
    finally { setCreatingRole(false); }
  };

  const setRoleActive = async (row: PermissionRow, active: boolean) => {
    if (!row.roles || savingRoleId) return;
    setSavingRoleId(row.role_id);
    try {
      const response = await fetch("/api/permissions", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role_id: row.role_id, active }) });
      if (!response.ok) throw new Error(await responseErrorMessage(response, active ? "Không thể mở khóa vai trò." : "Không thể khóa vai trò."));
      await load();
      notify("success", active ? "Đã mở khóa vai trò." : "Đã khóa vai trò.");
    } catch (error) { notify("error", errorMessage(error, "Không thể đổi trạng thái vai trò.")); }
    finally { setSavingRoleId(null); }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">
        <div className="mb-4 lg:mb-0"><AppNav currentPath="/permissions" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} /></div>
        <div>
          <div className="mb-4"><h1 className="text-2xl font-bold">Phân quyền</h1><p className="mt-1 text-sm text-slate-600">Thêm vai trò, cập nhật quyền và khóa vai trò không còn sử dụng.</p></div>
          <section className="mb-4 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-[1fr_2fr_100px_auto]">
            <input value={newRole.code} onChange={(event) => setNewRole({ ...newRole, code: event.target.value.toLowerCase() })} placeholder="Mã vai trò" maxLength={50} className="rounded border px-3 py-2" />
            <input value={newRole.name} onChange={(event) => setNewRole({ ...newRole, name: event.target.value })} placeholder="Tên vai trò" maxLength={120} className="rounded border px-3 py-2" />
            <input type="number" min="1" max="99" value={newRole.level} onChange={(event) => setNewRole({ ...newRole, level: Number(event.target.value) })} aria-label="Cấp vai trò" className="rounded border px-3 py-2" />
            <button disabled={creatingRole} onClick={() => void createRole()} className="rounded bg-orange-500 px-4 py-2 font-semibold text-white disabled:opacity-50">{creatingRole ? "Đang thêm..." : "Thêm vai trò"}</button>
          </section>
          <div className="mb-2 flex flex-wrap items-center gap-2"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded border bg-white px-3 py-2"><option value="active">Đang hoạt động</option><option value="locked">Đã khóa</option><option value="all">Tất cả</option></select><button onClick={() => void load()} className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600">Tải lại</button><p className="text-sm text-slate-600" aria-live="polite">{message}</p></div>
          <section className="overflow-auto rounded-xl border bg-white p-4">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50"><tr><th className="px-2 py-2">Vai trò</th>{columns.map((column) => <th key={column.key} className="px-2 py-2">{column.label}</th>)}{canRename ? <th className="px-2 py-2">Thao tác</th> : null}</tr></thead>
              <tbody>
                {rows.map((row) => {
                  const isEditing = editingRoleId === row.role_id;
                  return <tr key={row.role_id} className="border-t">
                    <td className="min-w-72 px-2 py-2 align-top">
                      {isEditing ? <input autoFocus maxLength={120} value={editingName} onChange={(event) => setEditingName(event.target.value)} className="w-full rounded border px-2 py-1" aria-label="Tên vai trò" /> : <span>{row.roles?.name ?? "(Chưa đặt tên)"}</span>}
                      <div className="mt-1 text-xs text-slate-500">Mã: {row.roles?.code ?? row.role_id} · {row.roles?.active === false ? "Đã khóa" : "Đang hoạt động"}</div>
                    </td>
                    {columns.map((column) => <td key={column.key} className="px-2 py-2 text-center"><input type="checkbox" checked={row[column.key]} disabled={!canRename || busyPermission} onChange={(event) => void updatePermission(row.role_id, column.key, event.target.checked)} aria-label={`${row.roles?.name ?? "Vai trò"}: ${column.label}`} /></td>)}
                    {canRename ? <td className="whitespace-nowrap px-2 py-2 align-top">{isEditing ? <><button disabled={savingRoleId === row.role_id} onClick={() => void saveName(row.role_id)} className="mr-2 rounded bg-orange-500 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">{savingRoleId === row.role_id ? "Đang lưu..." : "Lưu"}</button><button onClick={() => setEditingRoleId(null)} className="rounded bg-slate-200 px-3 py-1 text-xs">Hủy</button></> : <><button onClick={() => beginEdit(row)} className="mr-2 rounded bg-slate-200 px-3 py-1 text-xs font-semibold hover:bg-orange-50">Đổi tên</button><button disabled={row.roles?.code === "admin" || savingRoleId === row.role_id} onClick={() => void setRoleActive(row, row.roles?.active === false)} className="rounded bg-slate-200 px-3 py-1 text-xs font-semibold disabled:opacity-50">{row.roles?.active === false ? "Mở khóa" : "Khóa"}</button></>}</td> : null}
                  </tr>;
                })}
                {rows.length === 0 ? <tr><td colSpan={columns.length + (canRename ? 2 : 1)} className="px-2 py-8 text-center text-slate-500">Chưa có dữ liệu phân quyền.</td></tr> : null}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </main>
  );
}
