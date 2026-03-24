"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type UserDetail = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  roles?: { name: string } | null;
  departments?: { name: string } | null;
};

type Task = { id: string; title: string; status: string; progress_percent: number; due_date: string | null };

export default function UserDetailPage() {
  const router = useRouter();
  const { loading: authLoading, user: authUser, logout } = useAuth();
  const params = useParams<{ id: string }>();
  const userId = params?.id;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [message, setMessage] = useState("Đang tải thông tin user...");

  const loadData = async () => {
    if (!userId) return;

    const [userRes, taskRes] = await Promise.all([
      supabase
        .from("staff_users")
        .select("id,full_name,email,phone,active,roles(name),departments(name)")
        .eq("id", userId)
        .single(),
      supabase
        .from("tasks")
        .select("id,title,status,progress_percent,due_date")
        .eq("assignee_id", userId)
        .order("updated_at", { ascending: false }),
    ]);

    if (userRes.error || taskRes.error) {
      setMessage(`❌ ${userRes.error?.message || taskRes.error?.message}`);
      return;
    }

    setUser(userRes.data as unknown as UserDetail);
    setTasks((taskRes.data ?? []) as Task[]);
    setMessage("✅ Đã tải thông tin user.");
  };

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) return void router.push("/login");
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, authLoading, authUser, router]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Chi tiết user</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/" className="rounded bg-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-orange-50 hover:text-orange-800">Công việc</Link>
            <Link href="/users" className="rounded bg-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-orange-50 hover:text-orange-800">User</Link>
            <Link href="/permissions" className="rounded bg-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-orange-50 hover:text-orange-800">Phân quyền</Link>
            <Link href="/my-tasks" className="rounded bg-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-orange-50 hover:text-orange-800">Theo user</Link>
            <span className="text-xs text-slate-600">{authUser?.full_name} ({authUser?.role_name})</span>
            <button onClick={logout} className="rounded bg-orange-500 px-3 py-2 text-sm font-semibold text-white">Đăng xuất</button>
          </div>
        </div>

        <p className="mb-3 text-sm text-slate-600">{message}</p>

        {user ? (
          <>
            <section className="rounded-xl border bg-white p-4">
              <h2 className="text-xl font-semibold">{user.full_name}</h2>
              <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                <p><b>Email:</b> {user.email ?? "-"}</p>
                <p><b>SĐT:</b> {user.phone ?? "-"}</p>
                <p><b>Role:</b> {user.roles?.name ?? "-"}</p>
                <p><b>Phòng ban:</b> {user.departments?.name ?? "-"}</p>
                <p><b>Trạng thái:</b> {user.active ? "Active" : "Disabled"}</p>
              </div>
            </section>

            <section className="mt-4 rounded-xl border bg-white p-4">
              <h3 className="mb-2 text-lg font-semibold">Công việc đang phụ trách</h3>
              <table className="table-soft-red min-w-full text-left text-sm">
                <thead><tr><th className="px-2 py-2">Công việc</th><th className="px-2 py-2">Trạng thái</th><th className="px-2 py-2">Tiến độ</th><th className="px-2 py-2">Hạn</th><th className="px-2 py-2">Chi tiết</th></tr></thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id}>
                      <td className="px-2 py-2">{t.title}</td>
                      <td className="px-2 py-2">{t.status}</td>
                      <td className="px-2 py-2">{t.progress_percent}%</td>
                      <td className="px-2 py-2">{t.due_date ?? "-"}</td>
                      <td className="px-2 py-2"><Link href={`/tasks/${t.id}`} className="inline-flex items-center rounded border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-100 px-2 py-1 text-xs font-semibold text-orange-800 hover:from-orange-100 hover:to-amber-200">Mở</Link></td>
                    </tr>
                  ))}
                  {tasks.length === 0 ? <tr><td colSpan={5} className="px-2 py-6 text-center text-slate-500">User chưa có task.</td></tr> : null}
                </tbody>
              </table>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
