"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type User = { id: string; full_name: string };
type Task = { id: string; title: string; progress_percent: number; status: string; owner?: { full_name: string } | null; task_assignees?: { user_id: string; assignment_role: string; staff_users?: { full_name: string } | null }[] };
type Comment = { id: string; content: string; created_at: string; staff_users?: { full_name: string } | null };

export default function MyTasksPage() {
  const router = useRouter();
  const { loading: authLoading, user, hasPermission, logout } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [message, setMessage] = useState("Đang tải...");

  const loadUsers = async () => {
    // Nhân viên thường chỉ xem việc của chính mình
    if (user && !hasPermission("can_edit_all_tasks")) {
      const self = { id: user.id, full_name: user.full_name };
      setUsers([self]);
      setUserId(user.id);
      await loadTasksByUser(user.id);
      return;
    }

    const { data, error } = await supabase.from("staff_users").select("id,full_name").eq("active", true).order("full_name");
    if (error) return setMessage(`❌ ${error.message}`), undefined;
    const list = (data ?? []) as User[];
    setUsers(list);
    if (!userId && list.length) {
      setUserId(list[0].id);
      await loadTasksByUser(list[0].id);
    }
  };

  const loadTasksByUser = async (uid: string) => {
    if (!uid) return;
    const { data, error } = await supabase
      .from("tasks")
      .select("id,title,progress_percent,status,owner:staff_users!tasks_owner_id_fkey(full_name),task_assignees!inner(user_id,assignment_role,staff_users(full_name))")
      .eq("task_assignees.user_id", uid)
      .order("updated_at", { ascending: false });
    if (error) return setMessage(`❌ ${error.message}`), undefined;
    setTasks((data ?? []) as unknown as Task[]);
    setMessage(`✅ Đã tải ${(data ?? []).length} công việc của user.`);
  };

  const loadComments = async (taskId: string) => {
    if (!taskId) return;
    const { data, error } = await supabase
      .from("task_comments")
      .select("id,content,created_at,staff_users(full_name)")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    if (error) return setMessage(`❌ ${error.message}`), undefined;
    setComments((data ?? []) as unknown as Comment[]);
  };

  const updateProgress = async (taskId: string, progress: number) => {
    const oldTask = tasks.find((t) => t.id === taskId);
    const { error } = await supabase.from("tasks").update({ progress_percent: progress, updated_at: new Date().toISOString() }).eq("id", taskId);
    if (error) return setMessage(`❌ ${error.message}`), undefined;

    await supabase.from("task_progress_logs").insert({
      task_id: taskId,
      user_id: userId || null,
      old_progress: oldTask?.progress_percent ?? null,
      new_progress: progress,
      note: "Cập nhật từ trang công việc theo user",
    });

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, progress_percent: progress } : t)));
  };

  const addComment = async () => {
    if (!selectedTaskId || !commentText.trim()) return;
    const { error } = await supabase.from("task_comments").insert({ task_id: selectedTaskId, user_id: userId || null, content: commentText.trim() });
    if (error) return setMessage(`❌ ${error.message}`), undefined;
    setCommentText("");
    await loadComments(selectedTaskId);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    const t = setTimeout(() => {
      void loadUsers();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, router]);

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-bold sm:text-2xl">Công việc theo từng user</h1>
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

        <section className="rounded-xl border bg-white p-4">
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            {hasPermission("can_edit_all_tasks") ? (
              <button onClick={loadUsers} className="rounded bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Tải user</button>
            ) : null}
            <select
              value={userId}
              disabled={!hasPermission("can_edit_all_tasks")}
              onChange={(e) => {
                const v = e.target.value;
                setUserId(v);
                void loadTasksByUser(v);
              }}
              className="w-full rounded border px-3 py-3 disabled:opacity-50 sm:w-auto"
            >
            <option value="">-- Chọn user --</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
            <button onClick={() => loadTasksByUser(userId)} className="rounded bg-slate-700 px-4 py-3 text-sm font-semibold text-white">Tải task</button>
          </div>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Task của user</h2>

          <div className="space-y-2 md:hidden">
            {tasks.map((t) => (
              <div key={t.id} className="rounded border p-3 text-sm">
                <Link href={`/tasks/${t.id}`} className="font-medium text-blue-600 underline">{t.title}</Link>
                <p className="mt-1 text-xs text-slate-600">Owner: {t.owner?.full_name ?? "-"}</p>
                <p className="mt-1 text-xs text-slate-600">Trạng thái: {t.status}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs">Tiến độ:</span>
                  <input type="number" min={0} max={100} disabled={!hasPermission("can_edit_all_tasks")} value={t.progress_percent} onChange={(e) => updateProgress(t.id, Number(e.target.value || 0))} className="w-20 rounded border px-2 py-1 disabled:opacity-50" />
                </div>
                <button onClick={() => { setSelectedTaskId(t.id); void loadComments(t.id); }} className="mt-2 rounded bg-slate-200 px-3 py-2 text-xs">Mở comment</button>
              </div>
            ))}
          </div>

          <div className="hidden overflow-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50"><tr><th className="px-2 py-2">Task</th><th className="px-2 py-2">Owner</th><th className="px-2 py-2">Trạng thái</th><th className="px-2 py-2">Tiến độ</th><th className="px-2 py-2">Comment</th></tr></thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="px-2 py-2"><Link href={`/tasks/${t.id}`} className="text-blue-600 underline">{t.title}</Link></td>
                    <td className="px-2 py-2">{t.owner?.full_name ?? "-"}</td>
                    <td className="px-2 py-2">{t.status}</td>
                    <td className="px-2 py-2"><input type="number" min={0} max={100} disabled={!hasPermission("can_edit_all_tasks")} value={t.progress_percent} onChange={(e) => updateProgress(t.id, Number(e.target.value || 0))} className="w-20 rounded border px-2 py-1 disabled:opacity-50" /></td>
                    <td className="px-2 py-2"><button onClick={() => { setSelectedTaskId(t.id); void loadComments(t.id); }} className="rounded bg-slate-200 px-2 py-1 text-xs">Mở comment</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Comment công việc</h2>
          <div className="mb-2 flex flex-col gap-2 sm:flex-row">
            <input className="flex-1 rounded border px-3 py-3" placeholder="Nhập comment" value={commentText} onChange={(e) => setCommentText(e.target.value)} />
            <button onClick={addComment} disabled={!hasPermission("can_comment")} className="rounded bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:opacity-50">Gửi</button>
          </div>
          <div className="space-y-2">
            {comments.map((c) => (
              <div key={c.id} className="rounded border p-2 text-sm">
                <p>{c.content}</p>
                <p className="text-xs text-slate-500">{c.staff_users?.full_name ?? "User"} · {new Date(c.created_at).toLocaleString()}</p>
              </div>
            ))}
            {comments.length === 0 ? <p className="text-sm text-slate-500">Chọn task để xem comment.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
