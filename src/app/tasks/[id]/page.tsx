"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import AppNav from "@/components/AppNav";
import { RATING_OPTIONS, WEIGHT_OPTIONS, canEditTaskEvaluation, selectLatestFinalEvaluations, type CompletionLevel, type TaskEvaluationRow } from "@/lib/taskEvaluation";

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
  effort_weight: number;
  departments?: { name: string } | null;
  owner?: { full_name: string } | null;
  task_assignees?: { user_id: string; assignment_role: string; status: string; staff_users?: { full_name: string } | null }[];
};

type Comment = { id: string; content: string; created_at: string; staff_users?: { full_name: string } | null };
type ProgressLog = { id: string; old_progress: number | null; new_progress: number; note: string | null; created_at: string; staff_users?: { full_name: string } | null };

const difficultyLabel: Record<string, string> = {
  low: "Dễ",
  normal: "Vừa",
  high: "Khó",
  urgent: "Rất khó",
};

const taskStatusLabel: Record<string, string> = {
  new: "Mới",
  in_progress: "Đang làm",
  pending_review: "Chờ duyệt",
  done: "Hoàn thành",
  rejected: "Trả lại",
};
type TaskEvalForm = {
  rating: number;
  effortWeight: number;
  completion: CompletionLevel;
  onTime: boolean;
  opinion: string;
  checkpointDate: string;
  isFinal: boolean;
};

const todayText = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const defaultTaskEvalForm = (weight = 1): TaskEvalForm => ({
  rating: 7,
  effortWeight: weight,
  completion: "done",
  onTime: true,
  opinion: "",
  checkpointDate: todayText(),
  isFinal: true,
});

export default function TaskDetailPage() {
  const router = useRouter();
  const { loading: authLoading, user, logout, hasPermission, isReadOnly, canViewAllWorkHr } = useAuth();
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
  const [evaluationRows, setEvaluationRows] = useState<TaskEvaluationRow[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [taskEval, setTaskEval] = useState<TaskEvalForm>(defaultTaskEvalForm());
  const [savingEvaluation, setSavingEvaluation] = useState(false);

  const loadData = async () => {
    if (!taskId) return;

    const [taskRes, commentRes, logRes] = await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id,title,description,priority,status,progress_percent,due_date,attachment_url,assignee_id,owner_id,assignment_mode,effort_weight,departments(name),owner:staff_users!tasks_owner_id_fkey(full_name),task_assignees(user_id,assignment_role,status,staff_users(full_name))",
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
    const canViewTask = !!user && (hasPermission("can_edit_all_tasks") || canViewAllWorkHr() || loadedTask.owner_id === user.id || loadedTask.assignee_id === user.id || isAssigned);
    if (!canViewTask) {
      setTask(null);
      setComments([]);
      setLogs([]);
      setMessage("❌ Bạn không có quyền xem công việc của người khác.");
      router.push("/my-tasks");
      return;
    }

    const evaluator = canEditTaskEvaluation({ roleCode: user?.role_code, canManageUsers: hasPermission("can_manage_users") });
    let evaluationQuery = supabase
      .from("task_evaluation_checkpoints")
      .select("id,task_id,employee_id,reviewer_id,rating,effort_weight,completion,on_time,opinion,checkpoint_date,is_final,created_at")
      .eq("task_id", taskId)
      .order("checkpoint_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (!evaluator && user) evaluationQuery = evaluationQuery.eq("employee_id", user.id);
    const evaluationRes = await evaluationQuery;
    if (evaluationRes.error) {
      setMessage(`❌ ${evaluationRes.error.message}`);
      return;
    }

    const rows = (evaluationRes.data ?? []) as unknown as TaskEvaluationRow[];
    const finalRows = selectLatestFinalEvaluations(rows);
    const assignedIds = (loadedTask.task_assignees ?? [])
      .filter((assignee) => assignee.assignment_role !== "watcher")
      .map((assignee) => assignee.user_id);
    if (loadedTask.assignee_id && !assignedIds.includes(loadedTask.assignee_id)) assignedIds.push(loadedTask.assignee_id);
    const targetEmployeeId = evaluator ? (assignedIds[0] ?? "") : (user?.id ?? "");
    const latest = finalRows.find((row) => row.employee_id === targetEmployeeId);

    setTask(loadedTask);
    setEvaluationRows(rows);
    setSelectedEmployeeId(targetEmployeeId);
    setTaskEval(latest ? {
      rating: latest.rating,
      effortWeight: latest.effort_weight,
      completion: latest.completion ?? "done",
      onTime: latest.on_time ?? true,
      opinion: latest.opinion ?? "",
      checkpointDate: latest.checkpoint_date,
      isFinal: latest.is_final,
    } : defaultTaskEvalForm(loadedTask.effort_weight ?? 1));
    setNewProgress(loadedTask.progress_percent ?? 0);
    setComments((commentRes.data ?? []) as unknown as Comment[]);
    setLogs((logRes.data ?? []) as unknown as ProgressLog[]);
    setMessage("✅ Đã tải chi tiết công việc.");
  };

  const saveEvaluation = async () => {
    if (!task || !user || !selectedEmployeeId) return;
    if (!canEditTaskEvaluation({ roleCode: user.role_code, canManageUsers: hasPermission("can_manage_users") })) {
      setMessage("❌ Bạn không có quyền lưu đánh giá công việc.");
      return;
    }

    setSavingEvaluation(true);
    const { error } = await supabase.rpc("save_task_evaluation_checkpoint", {
      p_actor_id: user.id,
      p_task_id: task.id,
      p_employee_id: selectedEmployeeId,
      p_rating: taskEval.rating,
      p_effort_weight: taskEval.effortWeight,
      p_completion: taskEval.completion,
      p_on_time: taskEval.onTime,
      p_opinion: taskEval.opinion,
      p_checkpoint_date: taskEval.checkpointDate,
      p_is_final: taskEval.isFinal,
    });
    setSavingEvaluation(false);

    if (error) {
      setMessage(`❌ ${error.message}`);
      return;
    }

    setMessage("✅ Đã lưu đánh giá công việc.");
    await loadData();
  };

  const canUserSubmitReport = (targetTask: TaskDetail, userId: string) => {
    if (isReadOnly()) return false;
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
      const nextStatus = newProgress >= 100 ? "pending_review" : (task.status === "new" ? "in_progress" : task.status);

      const { error: updateError } = await supabase
        .from("tasks")
        .update({ progress_percent: newProgress, status: nextStatus, updated_at: new Date().toISOString() })
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
      setMessage(newProgress >= 100
        ? "✅ Đã gửi báo cáo hoàn thành cho người giao việc. Công việc chuyển sang trạng thái Chờ duyệt."
        : "✅ Đã gửi báo cáo tiến triển và vướng mắc cho người giao việc.");
      await loadData();
    } catch (e) {
      setMessage(`❌ ${(e as Error).message}`);
    } finally {
      setSubmittingReport(false);
    }
  };

  const markTaskDoneAndSubmit = async () => {
    if (!task || !user) return;
    const canSubmit = canUserSubmitReport(task, user.id);
    if (!canSubmit) return setMessage("❌ Bạn không có quyền hoàn thành công việc này."), undefined;

    setSubmittingReport(true);
    try {
      const oldProgress = task.progress_percent;
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ progress_percent: 100, status: "pending_review", updated_at: new Date().toISOString() })
        .eq("id", task.id);
      if (updateError) throw updateError;

      const { error: logError } = await supabase.from("task_progress_logs").insert({
        task_id: task.id,
        user_id: user.id,
        old_progress: oldProgress,
        new_progress: 100,
        note: "Đánh dấu hoàn thành, chuyển chờ phê duyệt",
      });
      if (logError) throw logError;

      const { error: commentError } = await supabase.from("task_comments").insert({
        task_id: task.id,
        user_id: user.id,
        content: "✅ Nhân viên đã đánh dấu hoàn thành. Công việc chuyển sang trạng thái Chờ duyệt.",
      });
      if (commentError) throw commentError;

      setNewProgress(100);
      setMessage("✅ Đã chuyển công việc sang Chờ duyệt. Chờ sếp phê duyệt để hoàn thành.");
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
  const canEditEvaluation = !!user && canEditTaskEvaluation({
    roleCode: user.role_code,
    canManageUsers: hasPermission("can_manage_users"),
  });
  const evaluationAssignees = (task?.task_assignees ?? []).filter((assignee) => assignee.assignment_role !== "watcher");
  if (task?.assignee_id && !evaluationAssignees.some((assignee) => assignee.user_id === task.assignee_id)) {
    evaluationAssignees.push({
      user_id: task.assignee_id,
      assignment_role: "assignee",
      status: task.status === "done" ? "done" : "in_progress",
      staff_users: { full_name: "Nhân viên được giao" },
    });
  }
  const finalEvaluationRows = selectLatestFinalEvaluations(evaluationRows);
  const visibleEvaluationRows = canEditEvaluation
    ? finalEvaluationRows
    : finalEvaluationRows.filter((row) => row.employee_id === user?.id);
  const latestVisibleEvaluation = canEditEvaluation
    ? (finalEvaluationRows.find((row) => row.employee_id === selectedEmployeeId) ?? null)
    : (visibleEvaluationRows[0] ?? null);

  const selectEmployeeEvaluation = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    const latest = finalEvaluationRows.find((row) => row.employee_id === employeeId);
    setTaskEval(latest ? {
      rating: latest.rating,
      effortWeight: latest.effort_weight,
      completion: latest.completion ?? "done",
      onTime: latest.on_time ?? true,
      opinion: latest.opinion ?? "",
      checkpointDate: latest.checkpoint_date,
      isFinal: latest.is_final,
    } : defaultTaskEvalForm(task?.effort_weight ?? 1));
  };

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">
        <div className="mb-4 lg:mb-0">
          <AppNav currentPath="/tasks/[id]" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
        </div>

        <div>
          <div className="mb-4">
            <h1 className="text-xl font-bold sm:text-2xl">Chi tiết công việc</h1>
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
                <p><b>Độ khó:</b> {difficultyLabel[task.priority] ?? task.priority}</p>
                <p><b>Trạng thái:</b> {taskStatusLabel[task.status] ?? task.status}</p>
                <p><b>Tiến độ:</b> {task.progress_percent}%</p>
              </div>
              <p className="mt-2 text-sm"><b>Người thực hiện:</b> {task.task_assignees?.map((a) => a.staff_users?.full_name).filter(Boolean).join(", ") || "-"}</p>
              {task.attachment_url ? (
                <a href={task.attachment_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center rounded border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-100 px-2 py-1 text-sm font-semibold text-orange-800 hover:from-orange-100 hover:to-amber-200">
                  Mở file đính kèm
                </a>
              ) : null}

              {hasPermission("can_edit_all_tasks") && task.status === "pending_review" ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
                  <button
                    onClick={async () => {
                      const { error } = await supabase.from("tasks").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", task.id);
                      if (error) return setMessage(`❌ ${error.message}`), undefined;
                      await supabase.from("task_comments").insert({
                        task_id: task.id,
                        user_id: user?.id,
                        content: "✅ Sếp đã phê duyệt. Công việc chuyển sang Hoàn thành.",
                      });
                      setMessage("✅ Đã phê duyệt công việc.");
                      await loadData();
                    }}
                    className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Phê duyệt hoàn thành
                  </button>
                  <button
                    onClick={async () => {
                      const { error } = await supabase.from("tasks").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", task.id);
                      if (error) return setMessage(`❌ ${error.message}`), undefined;
                      await supabase.from("task_comments").insert({
                        task_id: task.id,
                        user_id: user?.id,
                        content: "↩️ Sếp từ chối hoàn thành. Công việc chuyển về Trả lại.",
                      });
                      setMessage("✅ Đã trả lại công việc để chỉnh sửa.");
                      await loadData();
                    }}
                    className="rounded bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                  >
                    Trả lại công việc
                  </button>
                </div>
              ) : null}
            </section>

            <section className="mt-4 rounded-xl border bg-white p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold">Đánh giá công việc</h3>
                  <p className="text-xs text-slate-500">Điểm cuối kỳ mới nhất được tính theo trọng số; checkpoint giữa kỳ chỉ lưu phản hồi.</p>
                </div>
                {latestVisibleEvaluation ? <span className="rounded bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">{latestVisibleEvaluation.rating}/10</span> : null}
              </div>

              {canEditEvaluation ? (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="text-sm">Nhân viên
                      <select className="mt-1 w-full rounded border px-3 py-2" value={selectedEmployeeId} onChange={(e) => selectEmployeeEvaluation(e.target.value)}>
                        {evaluationAssignees.map((assignee) => <option key={assignee.user_id} value={assignee.user_id}>{assignee.staff_users?.full_name ?? "Nhân viên"}</option>)}
                      </select>
                    </label>
                    <label className="text-sm">Điểm (1-10)
                      <select className="mt-1 w-full rounded border px-3 py-2" value={taskEval.rating} onChange={(e) => setTaskEval((current) => ({ ...current, rating: Number(e.target.value) }))}>
                        {RATING_OPTIONS.map((score) => <option key={score} value={score}>{score}</option>)}
                      </select>
                    </label>
                    <label className="text-sm">Trọng số / độ lớn
                      <select className="mt-1 w-full rounded border px-3 py-2" value={taskEval.effortWeight} onChange={(e) => setTaskEval((current) => ({ ...current, effortWeight: Number(e.target.value) }))}>
                        {WEIGHT_OPTIONS.map((weight) => <option key={weight} value={weight}>{weight}</option>)}
                      </select>
                    </label>
                    <label className="text-sm">Mức hoàn thành
                      <select className="mt-1 w-full rounded border px-3 py-2" value={taskEval.completion} onChange={(e) => setTaskEval((current) => ({ ...current, completion: e.target.value as CompletionLevel }))}>
                        <option value="not_done">Không hoàn thành</option>
                        <option value="done">Hoàn thành</option>
                        <option value="excellent">Xuất sắc</option>
                      </select>
                    </label>
                    <label className="text-sm">Ngày checkpoint
                      <input type="date" className="mt-1 w-full rounded border px-3 py-2" value={taskEval.checkpointDate} onChange={(e) => setTaskEval((current) => ({ ...current, checkpointDate: e.target.value }))} />
                    </label>
                    <div className="flex flex-wrap items-center gap-4 pt-6 text-sm">
                      <label className="flex items-center gap-2"><input type="checkbox" checked={taskEval.onTime} onChange={(e) => setTaskEval((current) => ({ ...current, onTime: e.target.checked }))} />Đúng tiến độ</label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={taskEval.isFinal} onChange={(e) => setTaskEval((current) => ({ ...current, isFinal: e.target.checked }))} />Đánh giá cuối kỳ</label>
                    </div>
                  </div>
                  <label className="block text-sm">Ý kiến đánh giá
                    <textarea className="mt-1 min-h-24 w-full rounded border px-3 py-2" value={taskEval.opinion} onChange={(e) => setTaskEval((current) => ({ ...current, opinion: e.target.value }))} placeholder="Nhận xét kết quả, điểm mạnh và nội dung cần cải thiện..." />
                  </label>
                  <button type="button" onClick={saveEvaluation} disabled={savingEvaluation || !selectedEmployeeId} className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                    {savingEvaluation ? "Đang lưu..." : "Lưu đánh giá"}
                  </button>
                </div>
              ) : latestVisibleEvaluation ? (
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <p><b>Điểm:</b> {latestVisibleEvaluation.rating}/10</p>
                  <p><b>Trọng số:</b> {latestVisibleEvaluation.effort_weight}</p>
                  <p><b>Mức hoàn thành:</b> {latestVisibleEvaluation.completion === "excellent" ? "Xuất sắc" : latestVisibleEvaluation.completion === "done" ? "Hoàn thành" : "Không hoàn thành"}</p>
                  <p><b>Tiến độ:</b> {latestVisibleEvaluation.on_time ? "Đúng tiến độ" : "Chậm tiến độ"}</p>
                  <p><b>Kỳ đánh giá:</b> {latestVisibleEvaluation.is_final ? "Cuối kỳ" : "Giữa kỳ"} · {latestVisibleEvaluation.checkpoint_date}</p>
                  <p className="sm:col-span-2"><b>Ý kiến đánh giá:</b> {latestVisibleEvaluation.opinion || "-"}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Công việc chưa có kết quả đánh giá dành cho bạn.</p>
              )}
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

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={submitProgressReport}
                      disabled={submittingReport}
                      className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
                    >
                      {submittingReport ? "Đang gửi báo cáo..." : "Gửi báo cáo tiến độ"}
                    </button>
                    <button
                      onClick={markTaskDoneAndSubmit}
                      disabled={submittingReport || task.status === "pending_review" || task.status === "done"}
                      className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {task.status === "pending_review" ? "Đang chờ duyệt" : task.status === "done" ? "Đã hoàn thành" : "Ấn hoàn thành"}
                    </button>
                  </div>
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
      </div>
    </main>
  );
}
