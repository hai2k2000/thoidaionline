"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type TaskRow = {
  id: string;
  title: string;
  status: "new" | "in_progress" | "pending_review" | "done" | "rejected";
  priority: "low" | "normal" | "high" | "urgent";
  progress_percent: number;
  due_date: string | null;
  owner_id: string | null;
  assignee_id: string | null;
  owner?: { full_name: string } | null;
  assignee?: { full_name: string } | null;
  departments?: { name: string } | null;
  task_assignees?: Array<{ user_id: string; assignment_role: string; staff_users?: { full_name: string } | null }> | null;
};

type AssetAssignRow = {
  id: string;
  asset_id: string;
  assignee_id: string | null;
  status: string | null;
  assigned_at: string | null;
  returned_at: string | null;
  assets?: { asset_name: string | null; category: string | null; status: string | null } | null;
};

const statusLabel: Record<TaskRow["status"], string> = {
  new: "Mới",
  in_progress: "Đang làm",
  pending_review: "Chờ duyệt",
  done: "Hoàn thành",
  rejected: "Trả lại",
};

const priorityLabel: Record<TaskRow["priority"], string> = {
  low: "Thấp",
  normal: "Bình thường",
  high: "Cao",
  urgent: "Khẩn",
};

const assetStatusLabel: Record<string, string> = {
  available: "Sẵn sàng",
  in_use: "Đang sử dụng",
  maintenance: "Bảo trì",
  broken: "Hỏng",
  liquidated: "Thanh lý",
};

export default function ProfilePage() {
  const router = useRouter();
  const { loading: authLoading, user, logout } = useAuth();

  const [tasksAssignedToMe, setTasksAssignedToMe] = useState<TaskRow[]>([]);
  const [tasksAssignedByMe, setTasksAssignedByMe] = useState<TaskRow[]>([]);
  const [myAssets, setMyAssets] = useState<AssetAssignRow[]>([]);
  const [message, setMessage] = useState("Đang tải trang cá nhân...");

  const loadAll = async () => {
    if (!user?.id) return;

    const [taskRes, assetRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("id,title,status,priority,progress_percent,due_date,owner_id,assignee_id,departments(name),owner:staff_users!tasks_owner_id_fkey(full_name),assignee:staff_users!tasks_assignee_id_fkey(full_name),task_assignees(user_id,assignment_role,staff_users(full_name))")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("asset_assignments")
        .select("id,asset_id,assignee_id,status,assigned_at,returned_at,assets(asset_name,category,status)")
        .eq("assignee_id", user.id)
        .eq("status", "active")
        .is("returned_at", null)
        .order("assigned_at", { ascending: false }),
    ]);

    if (taskRes.error || assetRes.error) {
      setMessage(`❌ ${taskRes.error?.message || assetRes.error?.message}`);
      return;
    }

    const allTasks = (taskRes.data ?? []) as unknown as TaskRow[];
    const assignedToMe = allTasks.filter((t) => {
      const direct = t.assignee_id === user.id;
      const inMembers = (t.task_assignees ?? []).some((a) => a.user_id === user.id);
      return direct || inMembers;
    });
    const assignedByMe = allTasks.filter((t) => {
      if (t.owner_id !== user.id) return false;
      const directToMe = t.assignee_id === user.id;
      const memberToMe = (t.task_assignees ?? []).some((a) => a.user_id === user.id);
      // "Việc mình đang giao" chỉ là các việc giao cho người khác, không gồm việc tự làm.
      return !(directToMe || memberToMe);
    });

    setTasksAssignedToMe(assignedToMe);
    setTasksAssignedByMe(assignedByMe);
    setMyAssets((assetRes.data ?? []) as unknown as AssetAssignRow[]);
    setMessage("✅ Đã tải trang cá nhân.");
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    const t = setTimeout(() => {
      void loadAll();
    }, 0);
    return () => clearTimeout(t);
  }, [authLoading, user, router]);

  const stats = useMemo(() => ({
    assignedToMe: tasksAssignedToMe.length,
    assignedByMe: tasksAssignedByMe.length,
    myAssets: myAssets.length,
  }), [tasksAssignedToMe.length, tasksAssignedByMe.length, myAssets.length]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Trang cá nhân</h1>
          <div className="mt-2">
            <AppNav currentPath="/profile" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
          </div>
        </div>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-lg font-semibold">Thông tin cá nhân</h2>
          <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
            <p><b>Họ tên:</b> {user?.full_name ?? "-"}</p>
            <p><b>Vai trò:</b> {user?.role_name ?? "-"}</p>
            <p><b>Email:</b> {user?.email ?? "-"}</p>
            <p><b>Mã quyền:</b> {user?.role_code ?? "-"}</p>
          </div>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </section>

        <section className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500">Việc được giao</p>
            <p className="text-2xl font-bold text-sky-700">{stats.assignedToMe}</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500">Việc mình giao</p>
            <p className="text-2xl font-bold text-emerald-700">{stats.assignedByMe}</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500">Tài sản đang giữ</p>
            <p className="text-2xl font-bold text-violet-700">{stats.myAssets}</p>
          </div>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4 overflow-auto">
          <h2 className="mb-2 text-lg font-semibold">Công việc liên quan đến mình (được giao)</h2>
          <table className="table-soft-red min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2">Tiêu đề</th>
                <th className="px-2 py-2">Phòng ban</th>
                <th className="px-2 py-2">Ưu tiên</th>
                <th className="px-2 py-2">Trạng thái</th>
                <th className="px-2 py-2">Tiến độ</th>
                <th className="px-2 py-2">Deadline</th>
              </tr>
            </thead>
            <tbody>
              {tasksAssignedToMe.map((t) => (
                <tr key={`mine-${t.id}`} className="cursor-pointer" onClick={() => router.push(`/tasks/${t.id}`)}>
                  <td className="px-2 py-2">
                    <span className="inline-flex items-center rounded border border-blue-200 bg-gradient-to-r from-sky-50 to-blue-100 px-2 py-1 font-semibold text-blue-800">{t.title}</span>
                  </td>
                  <td className="px-2 py-2">{t.departments?.name ?? "-"}</td>
                  <td className="px-2 py-2">{priorityLabel[t.priority]}</td>
                  <td className="px-2 py-2">{statusLabel[t.status]}</td>
                  <td className="px-2 py-2">{t.progress_percent}%</td>
                  <td className="px-2 py-2">{t.due_date ?? "-"}</td>
                </tr>
              ))}
              {tasksAssignedToMe.length === 0 ? <tr><td className="px-2 py-4 text-slate-500" colSpan={6}>Chưa có việc được giao.</td></tr> : null}
            </tbody>
          </table>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4 overflow-auto">
          <h2 className="mb-2 text-lg font-semibold">Công việc mình đang giao cho người khác</h2>
          <table className="table-soft-red min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2">Tiêu đề</th>
                <th className="px-2 py-2">Người phụ trách</th>
                <th className="px-2 py-2">Ưu tiên</th>
                <th className="px-2 py-2">Trạng thái</th>
                <th className="px-2 py-2">Deadline</th>
              </tr>
            </thead>
            <tbody>
              {tasksAssignedByMe.map((t) => (
                <tr key={`byme-${t.id}`} className="cursor-pointer" onClick={() => router.push(`/tasks/${t.id}`)}>
                  <td className="px-2 py-2">
                    <span className="inline-flex items-center rounded border border-blue-200 bg-gradient-to-r from-sky-50 to-blue-100 px-2 py-1 font-semibold text-blue-800">{t.title}</span>
                  </td>
                  <td className="px-2 py-2">{t.assignee?.full_name ?? "-"}</td>
                  <td className="px-2 py-2">{priorityLabel[t.priority]}</td>
                  <td className="px-2 py-2">{statusLabel[t.status]}</td>
                  <td className="px-2 py-2">{t.due_date ?? "-"}</td>
                </tr>
              ))}
              {tasksAssignedByMe.length === 0 ? <tr><td className="px-2 py-4 text-slate-500" colSpan={5}>Bạn chưa giao việc nào.</td></tr> : null}
            </tbody>
          </table>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4 overflow-auto">
          <h2 className="mb-2 text-lg font-semibold">Tài sản đang được giao cho mình</h2>
          <table className="table-soft-red min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2">Tên tài sản</th>
                <th className="px-2 py-2">Nhóm</th>
                <th className="px-2 py-2">Tình trạng</th>
                <th className="px-2 py-2">Ngày giao</th>
              </tr>
            </thead>
            <tbody>
              {myAssets.map((a) => (
                <tr key={a.id} className="cursor-pointer" onClick={() => router.push(`/assets/${a.asset_id}`)}>
                  <td className="px-2 py-2">
                    <span className="inline-flex items-center rounded border border-blue-200 bg-gradient-to-r from-sky-50 to-blue-100 px-2 py-1 font-semibold text-blue-800">{a.assets?.asset_name ?? "-"}</span>
                  </td>
                  <td className="px-2 py-2">{a.assets?.category ?? "-"}</td>
                  <td className="px-2 py-2">{a.assets?.status ? (assetStatusLabel[a.assets.status] ?? a.assets.status) : "-"}</td>
                  <td className="px-2 py-2">{a.assigned_at ? new Date(a.assigned_at).toLocaleDateString("vi-VN") : "-"}</td>
                </tr>
              ))}
              {myAssets.length === 0 ? <tr><td className="px-2 py-4 text-slate-500" colSpan={4}>Chưa có tài sản được giao.</td></tr> : null}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
