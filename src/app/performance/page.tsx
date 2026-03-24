"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import AppNav from "@/components/AppNav";

type StaffUser = {
  id: string;
  full_name: string;
  username?: string | null;
  roles?: { code?: string | null } | null;
};

type TaskRow = {
  id: string;
  assignee_id?: string | null;
  owner_id?: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  status: "new" | "in_progress" | "pending_review" | "done" | "rejected";
  progress_percent: number;
  due_date: string | null;
  task_assignees?: { user_id: string; assignment_role: string }[] | null;
};

type AttendanceRow = {
  user_id: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
};

type EvalFormula = {
  attendanceWeight: number;
  completionWeight: number;
  hardTaskWeight: number;
  improvementWeight: number;
  teamContributionWeight: number;
};

type CompletionLevel = "not_done" | "done" | "excellent";
type TaskEvalConfig = {
  completion: CompletionLevel;
  onTime: boolean;
  hardTask: boolean;
  improvement: boolean;
  contribution: boolean;
};

const FORMULA_STORAGE_KEY = "thoidai_evaluation_formula_v1";
const TASK_EVAL_STORAGE_KEY = "thoidai_task_eval_v1";

const defaultFormula: EvalFormula = {
  attendanceWeight: 30,
  completionWeight: 30,
  hardTaskWeight: 20,
  improvementWeight: 10,
  teamContributionWeight: 10,
};

const completionPoint: Record<CompletionLevel, number> = {
  not_done: 0,
  done: 75,
  excellent: 100,
};

const difficultyPoint: Record<TaskRow["priority"], number> = {
  low: 25,
  normal: 50,
  high: 75,
  urgent: 100,
};

const toDateInput = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthStartOf = (dateText: string) => {
  const d = new Date(dateText);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};
const monthKeyOf = (dateText: string) => {
  const d = new Date(dateText);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const clamp100 = (n: number) => Math.max(0, Math.min(100, n));
const timeToMin = (t?: string | null) => {
  if (!t) return null;
  const [h, m] = t.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};
const workedHours = (checkIn?: string | null, checkOut?: string | null) => {
  const inMin = timeToMin(checkIn);
  const outMin = timeToMin(checkOut);
  if (inMin === null || outMin === null || outMin <= inMin) return 0;
  return (outMin - inMin) / 60;
};

function loadFormula(): EvalFormula {
  if (typeof window === "undefined") return defaultFormula;
  try {
    const raw = localStorage.getItem(FORMULA_STORAGE_KEY);
    if (!raw) return defaultFormula;
    const p = JSON.parse(raw) as Partial<EvalFormula>;
    return {
      attendanceWeight: Number(p.attendanceWeight ?? defaultFormula.attendanceWeight),
      completionWeight: Number(p.completionWeight ?? defaultFormula.completionWeight),
      hardTaskWeight: Number(p.hardTaskWeight ?? defaultFormula.hardTaskWeight),
      improvementWeight: Number(p.improvementWeight ?? defaultFormula.improvementWeight),
      teamContributionWeight: Number(p.teamContributionWeight ?? defaultFormula.teamContributionWeight),
    };
  } catch {
    return defaultFormula;
  }
}

function loadTaskEvalMap(): Record<string, TaskEvalConfig> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(TASK_EVAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function PerformancePage() {
  const router = useRouter();
  const { loading: authLoading, user, logout, canAccessModule, hasPermission } = useAuth();

  const [selectedDate, setSelectedDate] = useState(toDateInput());
  const [formula, setFormula] = useState<EvalFormula>(defaultFormula);
  const [taskEvalMap, setTaskEvalMap] = useState<Record<string, TaskEvalConfig>>({});

  const [allUsers, setAllUsers] = useState<StaffUser[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [message, setMessage] = useState("Đang tải dữ liệu đánh giá...");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setFormula(loadFormula());
      setTaskEvalMap(loadTaskEvalMap());
    }
  }, []);

  const loadData = async () => {
    const monthStart = monthStartOf(selectedDate);

    const [usersRes, taskRes, attendanceRes] = await Promise.all([
      supabase.from("staff_users").select("id,full_name,username,roles(code)").eq("active", true).order("full_name"),
      supabase
        .from("tasks")
        .select("id,assignee_id,owner_id,priority,status,progress_percent,due_date,task_assignees(user_id,assignment_role)")
        .order("created_at", { ascending: false })
        .limit(3000),
      supabase
        .from("attendance_logs")
        .select("user_id,work_date,check_in,check_out")
        .gte("work_date", monthStart)
        .lte("work_date", selectedDate)
        .limit(30000),
    ]);

    if (usersRes.error || taskRes.error) {
      setMessage(`❌ ${usersRes.error?.message || taskRes.error?.message}`);
      return;
    }

    const users = (usersRes.data ?? []) as unknown as StaffUser[];
    const nonChief = users.filter((u) => (u.roles?.code ?? "") !== "tong_bien_tap");
    setAllUsers(users);
    setTasks((taskRes.data ?? []) as unknown as TaskRow[]);

    if (attendanceRes.error) {
      const missingTable = attendanceRes.error.message.includes("schema cache") || attendanceRes.error.message.includes("Could not find the table");
      if (!missingTable) {
        setAttendanceRows([]);
        setMessage(`⚠️ ${attendanceRes.error.message}`);
        return;
      }

      const from = new Date(monthStart);
      const to = new Date(selectedDate);
      const all: AttendanceRow[] = [];
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 0) continue;
        const text = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        nonChief.forEach((u, idx) => {
          const inMin = 8 * 60 + 2 + (idx % 35);
          const outMin = 17 * 60 + 8 + (idx % 40);
          const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;
          all.push({ user_id: u.id, work_date: text, check_in: toTime(inMin), check_out: toTime(outMin) });
        });
      }
      setAttendanceRows(all);
      setMessage("✅ Dùng attendance demo từ đầu tháng (attendance_logs chưa sẵn).");
      return;
    }

    setAttendanceRows((attendanceRes.data ?? []) as AttendanceRow[]);
    setMessage("✅ Đã tải dữ liệu đánh giá.");
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void router.push("/login");
    if (!canAccessModule("performance")) return void router.push("/");
    const t = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(t);
  }, [authLoading, user, canAccessModule, router, selectedDate]);

  const monthTargetWorkDays = useMemo(() => {
    const from = new Date(monthStartOf(selectedDate));
    const to = new Date(selectedDate);
    let count = 0;
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0) count += 1;
    }
    return count;
  }, [selectedDate]);

  const chiefUserId = useMemo(() => {
    const u = allUsers.find((x) => (x.roles?.code ?? "") === "tong_bien_tap");
    return u?.id ?? null;
  }, [allUsers]);

  const defaultTaskEval = (t: TaskRow): TaskEvalConfig => {
    let completion: CompletionLevel = "done";
    if (t.status === "done" && (t.progress_percent ?? 0) >= 95) completion = "excellent";
    else if (t.status === "done") completion = "done";
    else if (t.status === "rejected") completion = "not_done";
    else completion = "not_done";

    const onTime = !!t.due_date ? t.due_date >= selectedDate : true;
    const title = (t as unknown as { title?: string }).title ?? "";

    return {
      completion,
      onTime,
      hardTask: ["high", "urgent"].includes(t.priority),
      improvement: /\[IMPROVE\]/i.test(title),
      contribution: !/\[NO_CONTRIB\]/i.test(title),
    };
  };

  const scoreRows = useMemo(() => {
    const users = allUsers
      .filter((u) => (u.roles?.code ?? "") !== "tong_bien_tap")
      .filter((u) => (hasPermission("can_edit_all_tasks") ? true : u.id === user?.id))
      .slice()
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));

    return users.map((u) => {
      const userAttendance = attendanceRows.filter((r) => r.user_id === u.id);
      const totalHours = userAttendance.reduce((sum, r) => sum + workedHours(r.check_in, r.check_out), 0);
      const workUnits = totalHours / 8;
      const attendanceScore = monthTargetWorkDays > 0 ? clamp100((workUnits / monthTargetWorkDays) * 100) : 0;

      const assignedTasks = tasks.filter((t) => {
        const mine = t.assignee_id === u.id || (t.task_assignees ?? []).some((a) => a.user_id === u.id);
        const fromChief = chiefUserId ? t.owner_id === chiefUserId : true;
        return mine && fromChief;
      });

      const evals = assignedTasks.map((t) => {
        const cfg = taskEvalMap[t.id] ?? defaultTaskEval(t);
        return { task: t, cfg };
      });

      const completionScore = evals.length > 0
        ? clamp100(evals.reduce((sum, x) => sum + (x.cfg.onTime ? completionPoint[x.cfg.completion] : completionPoint[x.cfg.completion] * 0.7), 0) / evals.length)
        : 0;

      const hardTaskScore = evals.length > 0
        ? clamp100(evals.reduce((sum, x) => sum + difficultyPoint[x.task.priority], 0) / evals.length)
        : 0;

      const improvementScore = evals.length > 0
        ? clamp100((evals.filter((x) => x.cfg.improvement).length / evals.length) * 100)
        : 0;

      const teamContributionScore = evals.length > 0
        ? clamp100((evals.filter((x) => x.cfg.contribution).length / evals.length) * 100)
        : 0;

      const totalWeight =
        formula.attendanceWeight +
        formula.completionWeight +
        formula.hardTaskWeight +
        formula.improvementWeight +
        formula.teamContributionWeight;

      const totalScore = totalWeight > 0
        ? (
          attendanceScore * formula.attendanceWeight +
          completionScore * formula.completionWeight +
          hardTaskScore * formula.hardTaskWeight +
          improvementScore * formula.improvementWeight +
          teamContributionScore * formula.teamContributionWeight
        ) / totalWeight
        : 0;

      const rank = totalScore >= 85 ? "A" : totalScore >= 70 ? "B" : totalScore >= 50 ? "C" : "D";

      return {
        userId: u.id,
        fullName: u.full_name,
        workUnits,
        attendanceScore,
        completionScore,
        hardTaskScore,
        improvementScore,
        teamContributionScore,
        totalScore,
        rank,
      };
    });
  }, [allUsers, attendanceRows, monthTargetWorkDays, tasks, taskEvalMap, chiefUserId, formula, selectedDate, hasPermission, user?.id]);

  const saveFormula = () => {
    if (typeof window === "undefined") return;
    localStorage.setItem(FORMULA_STORAGE_KEY, JSON.stringify(formula));
    setMessage("✅ Đã lưu công thức. Có thể chỉnh lại bất cứ lúc nào.");
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Đánh giá</h1>
          <div className="mt-2">
            <AppNav currentPath="/performance" userLabel={`${user?.full_name ?? ""} (${user?.role_name ?? ""})`} onLogout={logout} />
          </div>
        </div>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Công thức tính điểm (lưu để thay đổi về sau)</h2>
          <div className="mb-2 grid gap-2 md:grid-cols-6">
            <label className="text-xs">Ngày công (%)<input type="number" className="mt-1 w-full rounded border px-2 py-1" value={formula.attendanceWeight} onChange={(e) => setFormula((p) => ({ ...p, attendanceWeight: Number(e.target.value || 0) }))} /></label>
            <label className="text-xs">Hoàn thành (%)<input type="number" className="mt-1 w-full rounded border px-2 py-1" value={formula.completionWeight} onChange={(e) => setFormula((p) => ({ ...p, completionWeight: Number(e.target.value || 0) }))} /></label>
            <label className="text-xs">Độ khó công việc (%)<input type="number" className="mt-1 w-full rounded border px-2 py-1" value={formula.hardTaskWeight} onChange={(e) => setFormula((p) => ({ ...p, hardTaskWeight: Number(e.target.value || 0) }))} /></label>
            <label className="text-xs">Cải tiến (%)<input type="number" className="mt-1 w-full rounded border px-2 py-1" value={formula.improvementWeight} onChange={(e) => setFormula((p) => ({ ...p, improvementWeight: Number(e.target.value || 0) }))} /></label>
            <label className="text-xs">Đóng góp (%)<input type="number" className="mt-1 w-full rounded border px-2 py-1" value={formula.teamContributionWeight} onChange={(e) => setFormula((p) => ({ ...p, teamContributionWeight: Number(e.target.value || 0) }))} /></label>
            <div className="flex items-end"><button onClick={saveFormula} className="w-full rounded bg-rose-600 px-3 py-2 text-sm font-semibold text-white">Lưu công thức</button></div>
          </div>
          <label className="text-sm">Tính đến ngày
            <input type="date" className="mt-1 ml-2 rounded border px-3 py-2" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </label>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
          <p className="text-xs text-slate-500">Tiêu chí độ khó lấy trực tiếp từ trường Độ khó của công việc; các tiêu chí cải tiến/đóng góp và mức hoàn thành vẫn lấy từ trang chi tiết từng việc.</p>
        </section>

        <section className="mt-4 rounded-xl border bg-white p-4 overflow-auto">
          <h2 className="mb-2 text-lg font-semibold">Bảng điểm cá nhân</h2>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-2">Nhân sự</th>
                <th className="px-2 py-2">Ngày công</th>
                <th className="px-2 py-2">Hoàn thành</th>
                <th className="px-2 py-2">Độ khó</th>
                <th className="px-2 py-2">Cải tiến</th>
                <th className="px-2 py-2">Đóng góp</th>
                <th className="px-2 py-2">Điểm tổng</th>
                <th className="px-2 py-2">Xếp loại</th>
              </tr>
            </thead>
            <tbody>
              {scoreRows.map((r) => (
                <tr key={r.userId} className="border-t">
                  <td className="px-2 py-2 font-semibold">{r.fullName}</td>
                  <td className="px-2 py-2">{r.attendanceScore.toFixed(1)} <span className="text-xs text-slate-500">({r.workUnits.toFixed(2)} công)</span></td>
                  <td className="px-2 py-2">{r.completionScore.toFixed(1)}</td>
                  <td className="px-2 py-2">{r.hardTaskScore.toFixed(1)}</td>
                  <td className="px-2 py-2">{r.improvementScore.toFixed(1)}</td>
                  <td className="px-2 py-2">{r.teamContributionScore.toFixed(1)}</td>
                  <td className="px-2 py-2 font-semibold text-blue-700">{r.totalScore.toFixed(1)}</td>
                  <td className="px-2 py-2"><span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold">{r.rank}</span></td>
                </tr>
              ))}
              {scoreRows.length === 0 ? <tr><td className="px-2 py-6 text-center text-slate-500" colSpan={8}>Chưa có dữ liệu chấm điểm.</td></tr> : null}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
