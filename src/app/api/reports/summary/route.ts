import { getSessionUser } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";

const csv = (rows: Array<Record<string, string | number | null>>) => {
  if (!rows.length) return "module,metric,value\n";
  const headers = Object.keys(rows[0]);
  const esc = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h] ?? "")).join(","))].join("\n");
};

export async function GET() {
  const actor = await getSessionUser();
  if (!actor) return new Response("Unauthorized", { status: 401 });
  if (actor.role_code !== "admin") return new Response("Forbidden", { status: 403 });
  const today = new Date().toISOString().slice(0, 10);

  const [hrRes, assetInUseRes, docOverdueRes, reviewPendingRes, taskTotalRes, taskDoneRes] = await Promise.all([
    serverSupabase.from("employee_profiles").select("*", { count: "exact", head: true }),
    serverSupabase.from("assets").select("*", { count: "exact", head: true }).eq("status", "in_use"),
    serverSupabase.from("official_documents").select("*", { count: "exact", head: true }).lte("processing_deadline", today).neq("status", "done"),
    serverSupabase.from("performance_reviews").select("*", { count: "exact", head: true }).in("status", ["submitted", "reviewed"]),
    serverSupabase.from("tasks").select("*", { count: "exact", head: true }),
    serverSupabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "done"),
  ]);
  const queryError = [hrRes, assetInUseRes, docOverdueRes, reviewPendingRes, taskTotalRes, taskDoneRes].find((result) => result.error);
  if (queryError) return new Response("Không thể tạo báo cáo.", { status: 500 });

  const rows = [
    { module: "hr", metric: "employee_profiles", value: hrRes.count ?? 0 },
    { module: "assets", metric: "in_use", value: assetInUseRes.count ?? 0 },
    { module: "documents", metric: "overdue", value: docOverdueRes.count ?? 0 },
    { module: "performance", metric: "pending_reviews", value: reviewPendingRes.count ?? 0 },
    { module: "tasks", metric: "total", value: taskTotalRes.count ?? 0 },
    { module: "tasks", metric: "done", value: taskDoneRes.count ?? 0 },
  ];

  return new Response(csv(rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=thoidai-summary-${today}.csv`,
    },
  });
}
