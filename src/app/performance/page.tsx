"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import AppNav from "@/components/AppNav";
import {
  canEditTaskEvaluation,
  selectLatestFinalEvaluations,
  summarizeEmployeeEvaluation,
  taskDetailUrl,
  type TaskEvaluationRow,
} from "@/lib/taskEvaluation";

type StaffUser = {
  id: string;
  full_name: string;
  roles?: { code?: string | null } | null;
};

type TaskRow = {
  id: string;
  title: string;
  status: "new" | "in_progress" | "pending_review" | "done" | "rejected";
  assignee_id?: string | null;
  owner_id?: string | null;
  effort_weight: number;
  task_assignees?: { user_id: string; assignment_role: string }[] | null;
};

type EmployeeScoreRow = {
  userId: string;
  fullName: string;
  taskCount: number;
  completedCount: number;
  notCompletedCount: number;
  totalWeight: number;
  weightedPoints: number;
  weightedAverage: number;
  evaluatedTasks: Array<{
    taskId: string;
    title: string;
    status: string;
    rating: number;
    effortWeight: number;
    weightedPoints: number;
    completion: string;
    onTime: boolean;
    opinion?: string | null;
    checkpointDate: string;
  }>;
};

const statusLabel: Record<string, string> = {
  new: "Mới",
  in_progress: "Đang làm",
  pending_review: "Chờ duyệt",
  done: "Hoàn thành",
  rejected: "Trả lại",
};

const completionLabel: Record<string, string> = {
  not_done: "Không hoàn thành",
  done: "Hoàn thành",
  excellent: "Xuất sắc",
};

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

async function fetchAllRows<T>(fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>) {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { data: null, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}

export default function PerformancePage() {
  const router = useRouter();
  const { loading: authLoading, user, logout, hasPermission, canViewAllWorkHr } = useAuth();
  const [allUsers, setAllUsers] = useState<StaffUser[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [evaluations, setEvaluations] = useState<TaskEvaluationRow[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeScoreRow | null>(null);
  const [message, setMessage] = useState("Đang tải dữ liệu đánh giá...");

  const canEditEvaluation = !!user && canEditTaskEvaluation({
    roleCode: user.role_code,
    canManageUsers: hasPermission("can_manage_users"),
  });

  const loadData = async () => {
    const [usersRes, taskRes, evaluationRes] = await Promise.all([
      fetchAllRows<StaffUser>((from, to) => supabase
        .from("staff_users")
        .select("id,full_name,roles(code)")
        .eq("active", true)
        .order("full_name")
        .range(from, to) as unknown as PromiseLike<PageResult<StaffUser>>),
      fetchAllRows<TaskRow>((from, to) => supabase
        .from("tasks")
        .select("id,title,status,assignee_id,owner_id,effort_weight,task_assignees(user_id,assignment_role)")
        .order("created_at", { ascending: false })
        .range(from, to) as unknown as PromiseLike<PageResult<TaskRow>>),
      fetchAllRows<TaskEvaluationRow>((from, to) => {
        let query = supabase
          .from("task_evaluation_checkpoints")
          .select("id,task_id,employee_id,reviewer_id,rating,effort_weight,completion,on_time,opinion,checkpoint_date,is_final,created_at")
          .order("checkpoint_date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(from, to);
        if (!canEditEvaluation && !canViewAllWorkHr() && user) query = query.eq("employee_id", user.id);
        return query as unknown as PromiseLike<PageResult<TaskEvaluationRow>>;
      }),
    ]);

    if (usersRes.error || taskRes.error || evaluationRes.error) {
      setMessage(`❌ ${usersRes.error?.message || taskRes.error?.message || evaluationRes.error?.message}`);
      return;
    }

    setAllUsers(usersRes.data ?? []);
    setTasks(taskRes.data ?? []);
    setEvaluations(evaluationRes.data ?? []);
    setMessage("✅ Đã tải dữ liệu đánh giá công việc.");
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    const timer = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, router]);

  const scoreRows = useMemo(() => {
    if (!user) return [];
    const visibleUsers = allUsers
      .filter((staff) => (canEditEvaluation || canViewAllWorkHr() ? true : staff.id === user.id))
      .slice()
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));
    const latestFinal = selectLatestFinalEvaluations(evaluations);

    return visibleUsers.map((staff): EmployeeScoreRow => {
      const assignedTasks = tasks.filter((task) => {
        if (task.assignee_id === staff.id) return true;
        return (task.task_assignees ?? []).some(
          (assignee) => assignee.user_id === staff.id && assignee.assignment_role !== "watcher",
        );
      });
      const summary = summarizeEmployeeEvaluation({ tasks: assignedTasks, evaluations, employeeId: staff.id });
      const taskById = new Map(assignedTasks.map((task) => [task.id, task]));
      const evaluatedTasks = latestFinal
        .filter((evaluation) => evaluation.employee_id === staff.id && taskById.has(evaluation.task_id))
        .map((evaluation) => {
          const task = taskById.get(evaluation.task_id)!;
          return {
            taskId: task.id,
            title: task.title,
            status: task.status,
            rating: evaluation.rating,
            effortWeight: evaluation.effort_weight,
            weightedPoints: evaluation.rating * evaluation.effort_weight,
            completion: evaluation.completion ?? "done",
            onTime: evaluation.on_time ?? true,
            opinion: evaluation.opinion,
            checkpointDate: evaluation.checkpoint_date,
          };
        });

      return {
        userId: staff.id,
        fullName: staff.full_name,
        taskCount: summary.taskCount,
        completedCount: summary.completedCount,
        notCompletedCount: summary.notCompletedCount,
        totalWeight: summary.totalWeight,
        weightedPoints: summary.weightedPoints,
        weightedAverage: summary.weightedAverage,
        evaluatedTasks,
      };
    });
  }, [allUsers, canEditEvaluation, canViewAllWorkHr, evaluations, tasks, user]);

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">
        <div className="mb-4 lg:mb-0">
          <AppNav currentPath="/performance" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
        </div>

        <div>
          <div className="mb-4">
            <h1 className="text-2xl font-bold">Đánh giá công việc</h1>
            <p className="mt-1 text-sm text-slate-600">So sánh công bằng bằng điểm trung bình có trọng số; tổng điểm có trọng số phản ánh cả chất lượng và độ lớn công việc.</p>
          </div>

          <section className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 p-4 text-sm text-slate-700">
            <p><b>Công thức:</b> Tổng điểm = Σ(điểm 1-10 × trọng số). Điểm trung bình = Tổng điểm / Tổng trọng số đã đánh giá.</p>
            <p className="mt-1 text-xs text-slate-500">Chỉ checkpoint cuối kỳ mới nhất của từng công việc được cộng; checkpoint giữa kỳ chỉ lưu tiến độ và phản hồi.</p>
            <p className="mt-2">{message}</p>
          </section>

          <section className="mt-4 overflow-auto rounded-xl border bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">Danh sách nhân viên</h2>
            <table className="min-w-[850px] w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2">Nhân viên</th>
                  <th className="px-3 py-2 text-right">Số công việc</th>
                  <th className="px-3 py-2 text-right">Hoàn thành</th>
                  <th className="px-3 py-2 text-right">Không hoàn thành</th>
                  <th className="px-3 py-2 text-right">Tổng trọng số</th>
                  <th className="px-3 py-2 text-right">Tổng điểm có trọng số</th>
                  <th className="px-3 py-2 text-right">Điểm TB có trọng số</th>
                </tr>
              </thead>
              <tbody>
                {scoreRows.map((row) => (
                  <tr key={row.userId} className="cursor-pointer border-t transition hover:bg-blue-50" onClick={() => setSelectedEmployee(row)}>
                    <td className="px-3 py-3 font-semibold text-blue-700">{row.fullName}</td>
                    <td className="px-3 py-3 text-right">{row.taskCount}</td>
                    <td className="px-3 py-3 text-right text-emerald-700">{row.completedCount}</td>
                    <td className="px-3 py-3 text-right text-orange-700">{row.notCompletedCount}</td>
                    <td className="px-3 py-3 text-right">{row.totalWeight}</td>
                    <td className="px-3 py-3 text-right font-semibold">{row.weightedPoints.toFixed(1)}</td>
                    <td className="px-3 py-3 text-right font-bold text-blue-700">{row.totalWeight > 0 ? row.weightedAverage.toFixed(2) : "-"}</td>
                  </tr>
                ))}
                {scoreRows.length === 0 ? <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">Chưa có nhân viên hoặc dữ liệu công việc.</td></tr> : null}
              </tbody>
            </table>
          </section>
        </div>
      </div>

      {selectedEmployee ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3" role="dialog" aria-modal="true" aria-label={`Công việc đã đánh giá của ${selectedEmployee.fullName}`}>
          <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b bg-slate-50 px-4 py-3">
              <div>
                <h2 className="text-lg font-bold">{selectedEmployee.fullName}</h2>
                <p className="text-xs text-slate-500">{selectedEmployee.evaluatedTasks.length} công việc có đánh giá cuối kỳ</p>
              </div>
              <button type="button" onClick={() => setSelectedEmployee(null)} className="rounded border px-3 py-1 text-sm font-semibold hover:bg-white">Đóng</button>
            </div>
            <div className="max-h-[72vh] overflow-auto p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-blue-50 p-3"><p className="text-xs text-slate-500">Tổng điểm</p><p className="text-xl font-bold text-blue-700">{selectedEmployee.weightedPoints.toFixed(1)}</p></div>
                <div className="rounded-lg bg-cyan-50 p-3"><p className="text-xs text-slate-500">Tổng trọng số</p><p className="text-xl font-bold text-cyan-700">{selectedEmployee.totalWeight}</p></div>
                <div className="rounded-lg bg-emerald-50 p-3"><p className="text-xs text-slate-500">Điểm TB</p><p className="text-xl font-bold text-emerald-700">{selectedEmployee.totalWeight > 0 ? selectedEmployee.weightedAverage.toFixed(2) : "-"}</p></div>
              </div>

              <div className="mt-4 space-y-2">
                {selectedEmployee.evaluatedTasks.map((row) => (
                  <button key={row.taskId} type="button" onClick={() => router.push(taskDetailUrl(row.taskId))} className="w-full rounded-xl border p-3 text-left transition hover:border-blue-300 hover:bg-blue-50">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><p className="font-semibold text-blue-800">{row.title}</p><p className="text-xs text-slate-500">{statusLabel[row.status] ?? row.status} · {completionLabel[row.completion] ?? row.completion} · {row.onTime ? "Đúng tiến độ" : "Chậm tiến độ"}</p></div>
                      <div className="text-right"><p className="font-bold">{row.rating}/10 × {row.effortWeight}</p><p className="text-xs text-slate-500">{row.weightedPoints} điểm · {row.checkpointDate}</p></div>
                    </div>
                    {row.opinion ? <p className="mt-2 line-clamp-2 text-sm text-slate-600">{row.opinion}</p> : null}
                  </button>
                ))}
                {selectedEmployee.evaluatedTasks.length === 0 ? <p className="rounded border border-dashed p-6 text-center text-sm text-slate-500">Chưa có công việc được đánh giá cuối kỳ.</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}