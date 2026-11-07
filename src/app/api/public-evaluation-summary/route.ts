import { requireReadActor, apiError, apiJson } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { sortStaffRows } from "@/lib/staffOrdering";
import { resolveAttendanceAccess } from "@/lib/attendanceAccess";
import { taskHandlers } from "@/lib/taskHandlers";
import { buildEvaluationRows, type EvaluationTask, type EvaluationAttendance } from "@/lib/publicEvaluationSummary";

type CycleRow = { id: string; start_date: string; end_date: string };
type RoleRelation = { code?: string; level?: number } | Array<{ code?: string; level?: number }> | null;
type StaffRow = { id: string; username?: string | null; full_name: string; department_id?: string | null; roles?: RoleRelation; job_titles?: { code?: string; display_order?: number } | null; departments?: { code?: string | null; name?: string } | null };


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
  let taskQuery = serverSupabase.from("tasks").select("id,title,status,due_date,due_time,assignee_id,completion_score:task_completion_scores(total_score)").is("project_id", null).eq("task_category", "regular").neq("status", "cancelled");
  if (from && to) taskQuery = taskQuery.gte("due_date", from).lte("due_date", to);
  let attendanceQuery = serverSupabase.from("attendance_logs").select("user_id,work_date,status");
  let orgScope: "all" | "department" | null = null;
  try { const resolvedScope = (await resolveAttendanceAccess(g.actor)).orgScope; orgScope = resolvedScope === "all" || resolvedScope === "department" ? resolvedScope : null; } catch { orgScope = null; }
  if (orgScope === null) attendanceQuery = attendanceQuery.eq("user_id", g.actor.id);
  if (from && to) attendanceQuery = attendanceQuery.gte("work_date", from).lte("work_date", to);
  const [{ data: people, error: pe }, { data: tasks, error: te }, { data: attendance, error: ae }] = await Promise.all([
    serverSupabase.from("staff_users").select("id,username,full_name,roles(code,level),job_titles(code,display_order),departments!staff_users_department_id_fkey(name),department_id").eq("active", true).order("full_name"), taskQuery,
    attendanceQuery,
  ]);
  // Attendance is an optional HR module; keep the evaluation summary usable
  // while its table/migration is unavailable.
  if (pe || te) return apiError("operation_failed", 500);
  const viewable = await taskHandlers.viewableTaskIds(g.actor, ((tasks as EvaluationTask[] | null ?? []).map((task) => task.id)));
  if (!viewable.ok) return apiError("operation_failed", 500);
  const viewer = { id: g.actor.id, departmentId: g.actor.department_id ?? null, orgScope };
  const evaluationPeople = sortStaffRows((people as StaffRow[] | null ?? []).filter((p) => !((p.username ?? "").toLowerCase() === "admin") && !["tong_bien_tap", "tbt_read_only"].includes((Array.isArray(p.roles) ? p.roles[0]?.code : p.roles?.code) ?? ""))).map((p) => ({ id: p.id, full_name: p.full_name, department_id: p.department_id ?? null, department_name: p.departments?.name ?? "â€”" }));
  const rows = buildEvaluationRows({ people: evaluationPeople, tasks: (tasks as EvaluationTask[] | null ?? []).map((task) => ({ ...task, due_date: task.due_date ?? null, assignee_id: task.assignee_id ?? null })), attendance: (attendance as EvaluationAttendance[] | null ?? []).map((log) => ({ user_id: log.user_id ?? null, status: log.status ?? null })), attendanceAvailable: !ae, viewableTaskIds: viewable.ids, viewer, today: new Date().toISOString().slice(0, 10) });
  return apiJson({ period, cycle: cycleId, cycles: cycles ?? [], rows });
}
