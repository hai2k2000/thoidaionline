"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  progress_percent: number;
  due_date: string | null;
  attachment_url: string | null;
  assignee_id: string | null;
  owner_id: string | null;
  assignment_mode: "individual" | "multi_user" | "department" | "mixed";
  departments?: { name: string } | null;
  owner?: { full_name: string } | null;
  task_assignees?: { user_id: string; assignment_role: string; status: string; staff_users?: { full_name: string } | null }[];
};

type Comment = { id: string; content: string; created_at: string; staff_users?: { full_name: string } | null };
type ProgressLog = { id: string; old_progress: number | null; new_progress: number; note: string | null; created_at: string; staff_users?: { full_name: string } | null };

export default function TaskDetailPage() {
  const router = useRouter();
  const { loading: authLoading, user, logout, hasPermission } = useAuth();
  const params = useParams<{ id: string }>();
  const taskId = params?.id;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [message, setMessage] = useState("Đang tải chi tiết công việc...");
  const [newProgress, setNewProgress] = useState(0);
  const [reportText, setReportText] = useState("");
  const [blockersText, setBlockersText] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  const loadData = async () => {
    if (!taskId) return;

    const [taskRes, commentRes, logRes] = await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id,title,description,priority,status,progress_percent,due_date,attachment_url,assignee_id,owner_id,assignment_mode,departments(name),owner:staff_users!tasks_owner_id_fkey(full_name),task_assignees(user_id,assignment_role,status,staff_users(full_name))",
        )
        .eq("id", taskId)
        .single(),
      supabase
        .from("task_comments")
        .select("id,content,created_at,staff_users(full_name)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false }),
      supabase
        .from("task_progress_logs")
        .select("id,old_progress,new_progress,note,created_at,staff_users!task_progress_logs_user_id_fkey(full_name)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false }),
    ]);

    if (taskRes.error || commentRes.error || logRes.error) {
      setMessage(`❌ ${taskRes.error?.message || commentRes.error?.message || logRes.error?.message}`);
      return;
    }

    const loadedTask = taskRes.data as unknown as TaskDetail;

    const isAssigned = !!loadedTask.task_assignees?.some((a) => a.user_id === user?.id);
    const canViewTask = !!user && (hasPermission("can_edit_all_tasks") || loadedTask.owner_id === user.id || loadedTask.assignee_id === user.id || isAssigned);
    if (!canViewTask) {
      setTask(null);
      setComments([]);
      setLogs([]);
      setMessage("❌ Bạn không có quyền xem công việc của người khác.");
      router.push("/my-tasks");
      return;
    }

    setTask(loadedTask);
    setNewProgress(loadedTask.progress_percent ?? 0);
    setComments((commentRes.data ?? []) as unknown as Comment[]);
    setLogs((logRes.data ?? []) as unknown as ProgressLog[]);
    setMessage("✅ Đã tải chi tiết công việc.");
  };

  const canUserSubmitReport = (targetTask: TaskDetail, userId: string) => {
    if (hasPermission("can_edit_all_tasks")) return true;
    if (targetTask.assignment_mode === "department" || targetTask.assignment_mode === "mixed") return targetTask.owner_id === userId;
    return targetTask.owner_id === userId || targetTask.assignee_id === userId;
  };

  const submitProgressReport = async () => {
    if (!task || !user) return;
    if (!reportText.trim()) return setMessage("❌ Vui lòng nhập nội dung tiến triển công việc."), undefined;

    const canSubmit = canUserSubmitReport(task, user.id);
    if (!canSubmit) return setMessage("❌ Bạn chỉ có quyền xem; người chịu trách nhiệm chính mới được báo cáo."), undefined;

    setSubmittingReport(true);
    try {
      const oldProgress = task.progress_percent;

      const { error: updateError } = await supabase
        .from("tasks")
        .update({ progress_percent: newProgress, updated_at: new Date().toISOString() })
        .eq("id", task.id);
      if (updateError) throw updateError;

      const note = [
        `Báo cáo: ${reportText.trim()}`,
        blockersText.trim() ? `Vướng mắc: ${blockersText.trim()}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const { error: logError } = await supabase.from("task_progress_logs").insert({
        task_id: task.id,
        user_id: user.id,
        old_progress: oldProgress,
        new_progress: newProgress,
        note,
      });
      if (logError) throw logError;

      const { error: commentError } = await supabase.from("task_comments").insert({
        task_id: task.id,
        user_id: user.id,
        content: `📣 Báo cáo tiến độ (${newProgress}%): ${reportText.trim()}${blockersText.trim() ? `\n⚠️ Vướng mắc: ${blockersText.trim()}` : ""}`,
      });
      if (commentError) throw commentError;

      setReportText("");
      setBlockersText("");
      setMessage("✅ Đã gửi báo cáo tiến triển và vướng mắc cho người giao việc.");
      await loadData();
    } catch (e) {
      setMessage(`❌ ${(e as Error).message}`);
    } finally {
      setSubmittingReport(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, authLoading, user, router]);

  const canSubmitReport = !!(task && user && canUserSubmitReport(task, user.id));

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-bold sm:text-2xl">Chi tiết công việc</h1>
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

        <p className="mb-3 text-sm text-slate-600">{message}</p>

        {task ? (
          <>
            <section className="rounded-xl border bg-white p-4">
              <h2 className="text-xl font-semibold">{task.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{task.description || "(Không có mô tả)"}</p>
              <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                <p><b>Phòng:</b> {task.departments?.name ?? "-"}</p>
                <p><b>Owner chính:</b> {task.owner?.full_name ?? "-"}</p>
                <p><b>Hạn:</b> {task.due_date ?? "-"}</p>
                <p><b>Ưu tiên:</b> {task.priority}</p>
                <p><b>Trạng thái:</b> {task.status}</p>
                <p><b>Tiến độ:</b> {task.progress_percent}%</p>
              </div>
              <p className="mt-2 text-sm"><b>Người thực hiện:</b> {task.task_assignees?.map((a) => a.staff_users?.full_name).filter(Boolean).join(", ") || "-"}</p>
              {task.attachment_url ? (
                <a href={task.attachment_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-blue-600 underline">
                  Mở file đính kèm
                </a>
              ) : null}
            </section>

            <section className="mt-4 rounded-xl border bg-white p-4">
              <h3 className="mb-2 text-lg font-semibold">Báo cáo tiến triển & vướng mắc</h3>
              {canSubmitReport ? (
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Tiến độ hiện tại (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={newProgress}
                    onChange={(e) => setNewProgress(Number(e.target.value || 0))}
                    className="w-32 rounded border px-3 py-2"
                  />

                  <label className="block text-sm font-medium">Đang tiến triển thế nào? *</label>
                  <textarea
                    className="min-h-24 w-full rounded border px-3 py-2"
                    placeholder="Ví dụ: Đã hoàn thành 2/3 hạng mục, còn phần kiểm thử..."
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                  />

                  <label className="block text-sm font-medium">Có vướng mắc gì cần trao đổi/hỗ trợ?</label>
                  <textarea
                    className="min-h-20 w-full rounded border px-3 py-2"
                    placeholder="Ví dụ: thiếu dữ liệu, cần duyệt nội dung, cần thêm nhân sự..."
                    value={blockersText}
                    onChange={(e) => setBlockersText(e.target.value)}
                  />

                  <button
                    onClick={submitProgressReport}
                    disabled={submittingReport}
                    className="rounded bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:opacity-50"
                  >
                    {submittingReport ? "Đang gửi báo cáo..." : "Gửi báo cáo cho người giao việc"}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Với giao nhóm/phòng ban, chỉ người chịu trách nhiệm chính hoặc quản lý mới gửi báo cáo. Thành viên còn lại chỉ quan sát.</p>
              )}
            </section>

            <section className="mt-4 rounded-xl border bg-white p-4">
              <h3 className="mb-2 text-lg font-semibold">Comment</h3>
              <div className="space-y-2">
                {comments.map((c) => (
                  <div key={c.id} className="rounded border p-2 text-sm">
                    <p>{c.content}</p>
                    <p className="text-xs text-slate-500">{c.staff_users?.full_name ?? "User"} · {new Date(c.created_at).toLocaleString()}</p>
                  </div>
                ))}
                {comments.length === 0 ? <p className="text-sm text-slate-500">Chưa có comment.</p> : null}
              </div>
            </section>

            <section className="mt-4 rounded-xl border bg-white p-4">
              <h3 className="mb-2 text-lg font-semibold">Lịch sử tiến độ</h3>
              <div className="space-y-2">
                {logs.map((l) => (
                  <div key={l.id} className="rounded border p-2 text-sm">
                    <p>{l.old_progress ?? 0}% → {l.new_progress}%</p>
                    <p className="text-xs text-slate-500">{l.staff_users?.full_name ?? "User"} · {new Date(l.created_at).toLocaleString()} {l.note ? `· ${l.note}` : ""}</p>
                  </div>
                ))}
                {logs.length === 0 ? <p className="text-sm text-slate-500">Chưa có log tiến độ.</p> : null}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
