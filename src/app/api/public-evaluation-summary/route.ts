import { requireReadActor, apiError, apiJson } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { sortStaffRows } from "@/lib/staffOrdering";

export async function GET(request: Request) {
  const g = await requireReadActor(); if (!g.ok) return g.response;
  const period = new URL(request.url).searchParams.get("period") ?? "all";
  const now = new Date(); let from: string | null = null; let to: string | null = null;
  if (period === "month") { from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10); to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10); }
  if (period === "quarter") { const q = Math.floor(now.getMonth() / 3) * 3; from = new Date(now.getFullYear(), q, 1).toISOString().slice(0, 10); to = new Date(now.getFullYear(), q + 3, 0).toISOString().slice(0, 10); }
  if (period === "year") { from = `${now.getFullYear()}-01-01`; to = `${now.getFullYear()}-12-31`; }
  let taskQuery = serverSupabase.from("tasks").select("id,title,status,due_date,due_time,assignee_id,completion_score:task_completion_scores(total_score)").eq("task_category", "regular").neq("status", "cancelled");
  if (from && to) taskQuery = taskQuery.gte("due_date", from).lte("due_date", to);
  const [{ data: people, error: pe }, { data: tasks, error: te }] = await Promise.all([
    serverSupabase.from("staff_users").select("id,full_name,roles(code,level),job_titles(code,display_order),departments!staff_users_department_id_fkey(name)").eq("active", true).order("full_name"), taskQuery,
  ]);
  if (pe || te) return apiError("operation_failed", 500);
  const rows = sortStaffRows((people ?? []).filter((p: any) => !["admin", "tong_bien_tap", "tbt_read_only"].includes(Array.isArray(p.roles) ? p.roles[0]?.code : p.roles?.code)) as any).map((p: any) => {
    const own = (tasks ?? []).filter((t: any) => t.assignee_id === p.id); const done = own.filter((t: any) => t.status === "done");
    const returned = own.filter((t: any) => t.status === "rejected"); const inProgress = own.filter((t: any) => ["in_progress", "blocked"].includes(t.status)); const waiting = own.filter((t: any) => t.status === "pending_review");
    const overdue = own.filter((t: any) => t.status !== "done" && t.due_date && t.due_date < new Date().toISOString().slice(0, 10));
    const scores = own.map((t: any) => Array.isArray(t.completion_score) ? t.completion_score[0]?.total_score : null).filter((v: any) => v != null);
    return { id: p.id, name: p.full_name, department: p.departments?.name ?? "—", total: own.length, done: done.length, returned: returned.length, inProgress: inProgress.length, waiting: waiting.length, overdue: overdue.length, completionRate: own.length ? Math.round(done.length * 1000 / own.length) / 10 : 0, score: scores.length ? scores.reduce((a: number, b: number) => a + b, 0) : null, tasks: own.map((t: any) => ({ id: t.id, title: t.title, status: t.status, dueDate: t.due_date, score: Array.isArray(t.completion_score) ? t.completion_score[0]?.total_score : null })) };
  });
  return apiJson({ period, rows });
}
