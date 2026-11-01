import { requireReadActor, apiError, apiJson } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { sortStaffRows } from "@/lib/staffOrdering";

type CycleRow = { id: string; start_date: string; end_date: string };
type RoleRelation = { code?: string; level?: number } | Array<{ code?: string; level?: number }> | null;
type StaffRow = { id: string; username?: string | null; full_name: string; roles?: RoleRelation; job_titles?: { code?: string; display_order?: number } | null; departments?: { code?: string | null; name?: string } | null };
type TaskRow = { id: string; title: string; status: string; due_date?: string | null; assignee_id?: string | null; completion_score?: Array<{ total_score?: number | null }> | { total_score?: number | null } | null };
type AttendanceRow = { user_id?: string | null; status?: string | null };

export async function GET(request: Request) {
  const g = await requireReadActor(); if (!g.ok) return g.response;
  const params = new URL(request.url).searchParams;
  const period = params.get("period") ?? "all";
  const cycleId = params.get("cycle") ?? "all";
  const now = new Date(); let from: string | null = null; let to: string | null = null;
  if (period === "month") { from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10); to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10); }
  if (period === "quarter") { const q = Math.floor(now.getMonth() / 3) * 3; from = new Date(now.getFullYear(), q, 1).toISOString().slice(0, 10); to = new Date(now.getFullYear(), q + 3, 0).toISOString().slice(0, 10); }
  if (period === "year") { from = `${now.getFullYear()}-01-01`; to = `${now.getFullYear()}-12-31`; }
  const { data: cycles } = await serverSupabase.from("performance_cycles").select("id,name,start_date,end_date,status").order("start_date", { ascending: false });
  if (cycleId !== "all") { const cycle = (cycles as CycleRow[] | null ?? []).find((item) => item.id === cycleId); if (cycle) { from = cycle.start_date; to = cycle.end_date; } }
  let taskQuery = serverSupabase.from("tasks").select("id,title,status,due_date,due_time,assignee_id,completion_score:task_completion_scores(total_score)").eq("task_category", "regular").neq("status", "cancelled");
  if (from && to) taskQuery = taskQuery.gte("due_date", from).lte("due_date", to);
  let attendanceQuery = serverSupabase.from("attendance_logs").select("user_id,work_date,status");
  if (from && to) attendanceQuery = attendanceQuery.gte("work_date", from).lte("work_date", to);
  const [{ data: people, error: pe }, { data: tasks, error: te }, { data: attendance, error: ae }] = await Promise.all([
    serverSupabase.from("staff_users").select("id,username,full_name,roles(code,level),job_titles(code,display_order),departments!staff_users_department_id_fkey(name)").eq("active", true).order("full_name"), taskQuery,
    attendanceQuery,
  ]);
  // Attendance is an optional HR module; keep the evaluation summary usable
  // while its table/migration is unavailable.
  if (pe || te) return apiError("operation_failed", 500);
  const rows = sortStaffRows((people as StaffRow[] | null ?? []).filter((p) => !((p.username ?? "").toLowerCase() === "admin") && !["tong_bien_tap", "tbt_read_only"].includes((Array.isArray(p.roles) ? p.roles[0]?.code : p.roles?.code) ?? ""))).map((p) => {
    const own = (tasks as TaskRow[] | null ?? []).filter((t) => t.assignee_id === p.id); const done = own.filter((t) => t.status === "done");
    const returned = own.filter((t) => t.status === "rejected"); const inProgress = own.filter((t) => ["in_progress", "blocked"].includes(t.status)); const waiting = own.filter((t) => t.status === "pending_review");
    const overdue = own.filter((t) => t.status !== "done" && t.due_date && t.due_date < new Date().toISOString().slice(0, 10));
    const scores = own.map((t) => Array.isArray(t.completion_score) ? t.completion_score[0]?.total_score : null).filter((v): v is number => v != null);
    const employeeAttendance = ae ? [] : (attendance as AttendanceRow[] | null ?? []).filter((log) => log.user_id === p.id);
    const attended = employeeAttendance.filter((log) => ["present", "late"].includes((log.status ?? "").toLowerCase())).length;
    const attendanceRate = employeeAttendance.length ? Math.round(attended * 1000 / employeeAttendance.length) / 10 : null;
    return { id: p.id, name: p.full_name, department: p.departments?.name ?? "—", total: own.length, done: done.length, returned: returned.length, inProgress: inProgress.length, waiting: waiting.length, overdue: overdue.length, attendanceRate, score: scores.length ? scores.reduce((a: number, b: number) => a + b, 0) : null, tasks: own.map((t) => ({ id: t.id, title: t.title, status: t.status, dueDate: t.due_date, score: Array.isArray(t.completion_score) ? t.completion_score[0]?.total_score : null })) };
  });
  return apiJson({ period, cycle: cycleId, cycles: cycles ?? [], rows });
}
