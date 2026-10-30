import { apiError, apiJson, requireReadActor } from "@/lib/serverApi";
import { resolveAttendanceAccess } from "@/lib/attendanceAccess";
import { serverSupabase } from "@/lib/serverSupabase";
import { isAttendanceListedStaff, roleCodeFromRelation } from "@/lib/attendanceVisibility.mjs";
import { detectAttendanceAnomalies } from "@/lib/attendanceAnomalies.mjs";
import { writeXlsx } from "@/lib/xlsxWriter.mjs";

const PAGE_SIZE = 500;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (value: string) => DATE_PATTERN.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const readPages = async <T>(readPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message?: string | null } | null }>) => {
  const rows: T[] = [];
  for (let page = 0; page < 1000; page += 1) {
    const result = await readPage(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (result.error) return { data: rows, error: result.error };
    const pageRows = result.data ?? [];
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) return { data: rows, error: null };
  }
  return { data: rows, error: { message: "pagination exceeded safety limit" } };
};

export async function GET(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const access = await resolveAttendanceAccess(guard.actor);
  if (!access.canManage) return apiError("forbidden", 403);
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const threshold = Number.parseInt(params.get("threshold") ?? "10", 10);
  const rangeDays = (new Date(`${to}T12:00:00Z`).valueOf() - new Date(`${from}T12:00:00Z`).valueOf()) / 86400000 + 1;
  if (!isDate(from) || !isDate(to) || from > to || rangeDays > 93 || !Number.isInteger(threshold) || threshold < 1 || threshold > 120) return apiError("invalid_request", 400);
  const staffQuery = serverSupabase.from("staff_users").select("id,full_name,attendance_exempt,department_id,roles(code),departments!staff_users_department_id_fkey(name)").eq("active", true).order("full_name");
  const staffResult = await staffQuery;
  if (staffResult.error) return apiError("operation_failed", 500);
  const staffRows = (staffResult.data ?? []) as Array<{ id: string; full_name: string; attendance_exempt?: boolean; department_id?: string | null; roles?: unknown; departments?: { name: string } | { name: string }[] | null }>;
  const departmentScope = access.orgScope === "department";
  const staff = staffRows.filter((row) => (!departmentScope || row.department_id === guard.actor.department_id) && isAttendanceListedStaff({ full_name: row.full_name, attendance_exempt: row.attendance_exempt, roleCode: roleCodeFromRelation(row.roles) })).map((row) => ({ id: row.id, full_name: row.full_name, department_name: Array.isArray(row.departments) ? row.departments[0]?.name : row.departments?.name }));
  const staffIds = staff.map((row) => row.id);
  if (!staffIds.length) return apiJson({ from, to, threshold, findings: [], pairSummary: [], counts: { high: 0, medium: 0, low: 0, byType: {} } });
  const logsQuery = serverSupabase.from("attendance_logs").select("user_id,work_date,check_in,check_out").gte("work_date", from).lte("work_date", to).in("user_id", staffIds);
  const leaveQuery = serverSupabase.from("leave_requests").select("id,requester_id,start_date,end_date,start_period,end_period").eq("status", "approved").lte("start_date", to).gte("end_date", from).in("requester_id", staffIds);
  const scheduleQuery = serverSupabase.from("work_schedules").select("id,plan_type,title,work_date,end_date,start_time,end_time,participant_ids").eq("approval_status", "APPROVED").in("plan_type", ["business", "event"]).lte("work_date", to).gte("end_date", from);
  const [logsResult, leavesResult, schedulesResult] = await Promise.all([readPages((start, end) => logsQuery.range(start, end)), readPages((start, end) => leaveQuery.range(start, end)), readPages((start, end) => scheduleQuery.range(start, end))]);
  if (logsResult.error || leavesResult.error || schedulesResult.error) return apiError("operation_failed", 500);
  const schedules = schedulesResult.data ?? [];
  const eventIds = schedules.filter((item) => item.plan_type === "event").map((item) => item.id);
  const assignmentResult: { data: Array<{ event_id: string; staff_id: string }>; error: { message?: string | null } | null } = eventIds.length ? await readPages((start, end) => serverSupabase.from("work_schedule_event_assignments").select("event_id,staff_id").in("event_id", eventIds).range(start, end)) : { data: [], error: null };
  if (assignmentResult.error) return apiError("operation_failed", 500);
  const result = (detectAttendanceAnomalies as unknown as (input: Record<string, unknown>) => { findings: Array<{ type: string; severity: "high" | "medium" | "low"; staffIds: string[]; date: string; detail: Record<string, unknown>; message: string }>; pairSummary: Array<Record<string, unknown>> })({ logs: logsResult.data ?? [], leaves: leavesResult.data ?? [], schedules, eventAssignments: assignmentResult.data ?? [], staff, thresholdSeconds: threshold });
  const counts: { high: number; medium: number; low: number; byType: Record<string, number> } = { high: 0, medium: 0, low: 0, byType: {} };
  result.findings.forEach((finding) => { counts[finding.severity] += 1; counts.byType[finding.type] = (counts.byType[finding.type] ?? 0) + 1; });
  const payload = { from, to, threshold, findings: result.findings.map((finding) => ({ ...finding, staff: finding.staffIds.map((id) => staff.find((item) => item.id === id)?.full_name ?? id) })), pairSummary: result.pairSummary.map((pair) => ({ ...pair, staff: pair.names })), counts };
  if (params.get("format") === "xlsx") {
    const rows = [{ height: 24, cells: [{ value: `Rà soát bất thường ${from} - ${to}`, style: "title" }, ...Array(4).fill({ value: "", style: "title" })] }, { cells: ["Mức độ", "Loại", "Nhân sự", "Ngày", "Chi tiết"].map((value) => ({ value, style: "header" })) }, ...payload.findings.map((item) => ({ cells: [{ value: item.severity, style: item.severity }, { value: item.type }, { value: item.staff.join(", ") }, { value: item.date }, { value: item.message }].map((cell) => ({ ...cell, style: cell.style ?? "bordered" })) }))];
    return new Response(writeXlsx({ name: "Anomaly review", columns: [{ width: 14 }, { width: 24 }, { width: 28 }, { width: 14 }, { width: 80 }], rows, merges: ["A1:E1"], styles: { title: { font: { name: "Times New Roman", bold: true, size: 16 }, alignment: { horizontal: "center" }, border: true }, header: { font: { name: "Times New Roman", bold: true }, border: true }, bordered: { font: { name: "Times New Roman" }, border: true }, high: { font: { name: "Times New Roman", color: "FFDC2626" }, border: true }, medium: { font: { name: "Times New Roman", color: "FFF59E0B" }, border: true }, low: { font: { name: "Times New Roman", color: "FF64748B" }, border: true } } }), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename=attendance-anomalies-${from}-${to}.xlsx` } });
  }
  return apiJson(payload);
}
