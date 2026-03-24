"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import AppNav from "@/components/AppNav";

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
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Quản trị phân quyền</h1>
          <div className="mt-2">
            <AppNav currentPath="/permissions" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
          </div>
        </div>
        <div className="mb-2 flex gap-2">
          <button onClick={load} className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">Tải phân quyền</button>
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
