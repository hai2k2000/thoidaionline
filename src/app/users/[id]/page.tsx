"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import AppNav from "@/components/AppNav";

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

const taskStatusLabel: Record<string, string> = {
  new: "Mới",
  in_progress: "Đang làm",
  pending_review: "Chờ chấm điểm",
  done: "Hoàn thành",
  rejected: "Trả lại",
};

export default function UserDetailPage() {
  const router = useRouter();
  const { loading: authLoading, user: authUser, logout, hasPermission } = useAuth();
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
    if (!hasPermission("can_manage_users")) return void router.push("/");
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, authLoading, authUser, router, hasPermission]);

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4 lg:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row">
        <AppNav currentPath="/users" userLabel={`${authUser?.full_name ?? ""} (${authUser?.role_name ?? ""})`} onLogout={logout} />
        <div className="min-w-0 flex-1">
          <header className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
            <Link href="/users" className="inline-flex min-h-10 items-center rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800 transition hover:bg-orange-100">← Danh sách tài khoản</Link>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Quản lý nhân viên</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Chi tiết tài khoản</h1></div>
              <span role="status" className={`table-status ${user?.active ? "table-status-success" : "table-status-neutral"}`}>{user ? (user.active ? "Đang hoạt động" : "Đã khóa") : "Đang tải"}</span>
            </div>
            <p className="mt-3 text-sm text-slate-600" aria-live="polite">{message}</p>
          </header>

        {user ? (
          <>
            <section className="mt-4 rounded-xl border bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-xl font-semibold">{user.full_name}</h2>
              <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                <p><b>Thư điện tử:</b> {user.email ?? "-"}</p>
                <p><b>SĐT:</b> {user.phone ?? "-"}</p>
                <p><b>Vai trò:</b> {user.roles?.name ?? "-"}</p>
                <p><b>Phòng ban:</b> {user.departments?.name ?? "-"}</p>
                <p><b>Trạng thái:</b> <span className={`table-status ${user.active ? "table-status-success" : "table-status-neutral"}`}>{user.active ? "Đang hoạt động" : "Đã khóa"}</span></p>
              </div>
            </section>

            <section className="mt-4 rounded-xl border bg-white p-4 shadow-sm sm:p-5">
              <h3 className="mb-2 text-lg font-semibold">Công việc đang phụ trách</h3>
              <div className="table-scroll rounded-lg border border-slate-200" tabIndex={0} aria-label="Công việc đang phụ trách, cuộn ngang để xem thêm">
              <table className="table-soft-red data-table min-w-[760px] text-left text-sm">
                <thead><tr><th scope="col" className="min-w-72 px-3 py-2">Công việc</th><th scope="col" className="px-3 py-2">Trạng thái</th><th scope="col" className="px-3 py-2 text-right">Tiến độ</th><th scope="col" className="px-3 py-2">Hạn</th><th scope="col" className="px-3 py-2">Chi tiết</th></tr></thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id}>
                      <td className="min-w-72 px-3 py-2">{t.title}</td>
                      <td className="px-3 py-2"><span className={`table-status ${t.status === "done" ? "table-status-success" : t.status === "rejected" ? "table-status-danger" : t.status === "pending_review" ? "table-status-warning" : "table-status-neutral"}`}>{taskStatusLabel[t.status] ?? t.status}</span></td>
                      <td className="px-3 py-2 text-right font-semibold">{t.progress_percent}%</td>
                      <td className="whitespace-nowrap px-3 py-2">{t.due_date ?? "-"}</td>
                      <td className="whitespace-nowrap px-3 py-2"><Link href={`/tasks/${t.id}`} className="inline-flex items-center rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100">Mở</Link></td>
                    </tr>
                  ))}
                  {tasks.length === 0 ? <tr><td colSpan={5} className="px-2 py-6 text-center text-slate-500">Tài khoản chưa có công việc.</td></tr> : null}
                </tbody>
              </table>
              </div>
            </section>
          </>
        ) : null}
        </div>
      </div>
    </main>
  );
}
