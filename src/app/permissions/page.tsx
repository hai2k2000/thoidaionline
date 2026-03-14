"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type PermissionRow = {
  role_id: string;
  can_manage_users: boolean;
  can_manage_permissions: boolean;
  can_create_task: boolean;
  can_edit_all_tasks: boolean;
  can_comment: boolean;
  roles?: { name: string } | null;
};

export default function PermissionsPage() {
  const router = useRouter();
  const { loading: authLoading, user, hasPermission, logout } = useAuth();

  const [rows, setRows] = useState<PermissionRow[]>([]);
  const [message, setMessage] = useState("Đang tải...");

  const load = async () => {
    const { data, error } = await supabase
      .from("role_permissions")
      .select("role_id, can_manage_users, can_manage_permissions, can_create_task, can_edit_all_tasks, can_comment, roles(name)")
      .order("role_id");
    if (error) return setMessage(`❌ ${error.message}`), undefined;
    setRows((data ?? []) as unknown as PermissionRow[]);
    setMessage("✅ Đã tải phân quyền.");
  };

  const update = async (roleId: string, field: keyof Omit<PermissionRow, "role_id" | "roles">, value: boolean) => {
    const { error } = await supabase.from("role_permissions").update({ [field]: value, updated_at: new Date().toISOString() }).eq("role_id", roleId);
    if (error) return setMessage(`❌ ${error.message}`), undefined;
    setRows((prev) => prev.map((r) => (r.role_id === roleId ? { ...r, [field]: value } : r)));
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!hasPermission("can_manage_permissions")) return void router.push("/");
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [authLoading, user, hasPermission, router]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Quản trị phân quyền</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/" className="rounded bg-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-sky-100 hover:text-sky-700">Công việc</Link>
            <Link href="/users" className="rounded bg-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-sky-100 hover:text-sky-700">User</Link>
            <Link href="/departments" className="rounded bg-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-sky-100 hover:text-sky-700">Phòng ban</Link>
            <Link href="/permissions" className="rounded bg-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-sky-100 hover:text-sky-700">Phân quyền</Link>
            <Link href="/my-tasks" className="rounded bg-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-sky-100 hover:text-sky-700">Theo user</Link>
            <span className="text-xs text-slate-600">{user?.full_name} ({user?.role_name})</span>
            <button onClick={logout} className="rounded bg-sky-600 px-3 py-2 text-sm font-semibold text-white">Đăng xuất</button>
          </div>
        </div>
        <div className="mb-2 flex gap-2">
          <button onClick={load} className="rounded bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600">Tải phân quyền</button>
          <p className="self-center text-sm text-slate-600">{message}</p>
        </div>
        <section className="rounded-xl border bg-white p-4">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50"><tr><th className="px-2 py-2">Role</th><th className="px-2 py-2">Manage users</th><th className="px-2 py-2">Manage perms</th><th className="px-2 py-2">Create task</th><th className="px-2 py-2">Edit all</th><th className="px-2 py-2">Comment</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.role_id} className="border-t">
                  <td className="px-2 py-2">{r.roles?.name ?? r.role_id}</td>
                  {(["can_manage_users","can_manage_permissions","can_create_task","can_edit_all_tasks","can_comment"] as const).map((f) => (
                    <td key={f} className="px-2 py-2"><input type="checkbox" checked={r[f]} onChange={(e) => update(r.role_id, f, e.target.checked)} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
