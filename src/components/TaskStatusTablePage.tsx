"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AppNav from "@/components/AppNav";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Task = {
  id: string;
  title: string;
  assignee_id?: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  status: "new" | "in_progress" | "pending_review" | "done" | "rejected";
  progress_percent: number;
  due_date: string | null;
  departments?: { name: string } | null;
  task_assignees?: { user_id: string; staff_users?: { full_name: string | null } | null }[];
};

const priorityLabel: Record<Task["priority"], string> = {
  low: "Dễ",
  normal: "Vừa",
  high: "Khó",
  urgent: "Rất khó",
};

const statusLabel: Record<Task["status"], string> = {
  new: "Mới",
  in_progress: "Đang làm",
  pending_review: "Chờ duyệt",
  done: "Hoàn thành",
  rejected: "Trả lại",
};

const priorityTone: Record<Task["priority"], string> = {
  low: "bg-slate-100 text-slate-700",
  normal: "bg-gradient-to-r from-orange-100 to-amber-200 text-orange-800",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-orange-100 text-orange-800",
};

const statusTone: Record<Task["status"], string> = {
  new: "bg-slate-100 text-slate-700",
  in_progress: "bg-indigo-100 text-indigo-700",
  pending_review: "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
  rejected: "bg-orange-100 text-orange-800",
};

export default function TaskStatusTablePage({
  title,
  currentPath,
  mode,
}: {
  title: string;
  currentPath: string;
  mode: "active" | "pending_review" | "done";
}) {
  const router = useRouter();
  const { loading: authLoading, user, logout, hasPermission } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [message, setMessage] = useState("Đang tải dữ liệu...");

  const loadData = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("id,title,assignee_id,priority,status,progress_percent,due_date,departments(name),task_assignees(user_id,staff_users(full_name))")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) return setMessage(`❌ ${error.message}`), undefined;

    const fetched = (data ?? []) as unknown as Task[];
    const visible = hasPermission("can_edit_all_tasks")
      ? fetched
      : fetched.filter((t) => {
          const inAssigneeList = (t.task_assignees ?? []).some((a) => a.user_id === user?.id);
          return t.assignee_id === user?.id || inAssigneeList;
        });

    setTasks(visible);
    setMessage(`✅ Đã tải ${visible.length} công việc.`);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, router]);

  const rows = useMemo(() => {
    if (mode === "active") {
      return tasks.filter((t) => t.status === "new" || t.status === "in_progress" || t.status === "rejected");
    }
    if (mode === "pending_review") return tasks.filter((t) => t.status === "pending_review");
    return tasks.filter((t) => t.status === "done");
  }, [tasks, mode]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl p-6 lg:grid lg:grid-cols-[250px_1fr] lg:gap-4">
        <div className="mb-4 lg:mb-0">
          <AppNav currentPath={currentPath} userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
        </div>

        <div>
          <h1 className="mb-2 text-2xl font-bold">{title}</h1>
          <p className="mb-3 text-sm text-slate-600">{message}</p>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-700">Tổng: {rows.length} công việc</div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-blue-100">
              <table className="table-soft-red min-w-full text-left text-sm">
                <thead className="text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2">Công việc</th>
                    <th className="px-3 py-2">Phòng</th>
                    <th className="px-3 py-2">Giao cho ai</th>
                    <th className="px-3 py-2">Độ khó</th>
                    <th className="px-3 py-2">Đến hạn</th>
                    <th className="px-3 py-2">Tiến độ</th>
                    <th className="px-3 py-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} className="align-middle">
                      <td className="px-3 py-2">
                        <Link href={`/tasks/${t.id}`} className="inline-flex items-center rounded bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-200">
                          {t.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{t.departments?.name ?? "-"}</td>
                      <td className="px-3 py-2">{t.task_assignees?.map((a) => a.staff_users?.full_name).filter(Boolean).join(", ") || "-"}</td>
                      <td className="px-3 py-2"><span className={`rounded px-2 py-1 text-xs font-semibold ${priorityTone[t.priority]}`}>{priorityLabel[t.priority]}</span></td>
                      <td className="px-3 py-2">{t.due_date ? new Date(t.due_date).toLocaleDateString("vi-VN") : "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="w-28">
                          <div className="mb-1 h-2 rounded bg-slate-200">
                            <div className="h-2 rounded bg-indigo-500" style={{ width: `${Math.min(100, Math.max(0, t.progress_percent))}%` }} />
                          </div>
                          <div className="text-xs text-slate-600">{t.progress_percent}%</div>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-semibold ${statusTone[t.status]}`}>
                          {statusLabel[t.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">Không có công việc.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
