import { apiError, apiJson, requireReadActor } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { FOREIGN_REPORTERS, isForeignReporter } from "@/lib/onlineWorkLanguage.mjs";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type AttendanceRow = {
  id: string;
  user_id: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
  note: string | null;
  status: string | null;
  staff_users?: { full_name: string } | null;
};

type ContextRow = { work_date: string; start_date: string; end_date: string; start_period: string; end_period: string; leave_type: string; status: string; staff_id?: string; staff_name?: string };

const isValidDate = (value: string) => {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

const isMissingAttendanceTable = (error: { code?: string | null; message?: string | null } | null) =>
  !!error && (
    error.code === "PGRST205"
    || error.message?.includes("schema cache") === true
    || error.message?.includes("Could not find the table") === true
  );

export async function GET(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;

  const params = new URL(request.url).searchParams;
  const date = params.get("date") ?? "";
  const period = params.get("period") ?? "day";
  const scope = params.get("scope") ?? "personal";
  if (!isValidDate(date) || !["personal", "organization"].includes(scope) || !["day", "week", "month"].includes(period)) {
    return apiError("invalid_request", 400);
  }
  if (scope === "organization" && guard.actor.role_code !== "admin") {
    return apiError("forbidden", 403);
  }

  // Organization-wide attendance is deliberately an admin-only scope. The
  // personal scope remains tied to the signed-in actor even for administrators.
  const organizationScope = scope === "organization";
  const anchor = new Date(`${date}T12:00:00Z`);
  const monthStart = `${date.slice(0, 7)}-01`;
  let rangeStart = date;
  let rangeEnd = date;
  if (period === "week") {
    const day = anchor.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = new Date(anchor);
    start.setUTCDate(start.getUTCDate() + mondayOffset);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    rangeStart = start.toISOString().slice(0, 10);
    rangeEnd = end.toISOString().slice(0, 10);
  } else if (period === "month") {
    rangeStart = monthStart;
    const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0, 12));
    rangeEnd = end.toISOString().slice(0, 10);
  }
  let dayQuery = serverSupabase
    .from("attendance_logs")
    .select("id,user_id,work_date,check_in,check_out,note,status,staff_users(full_name)")
    .gte("work_date", rangeStart)
    .lte("work_date", rangeEnd)
    .order("check_in", { ascending: true, nullsFirst: false })
    .limit(500);
  let monthQuery = serverSupabase
    .from("attendance_logs")
    .select("id,user_id,work_date,check_in,check_out,note,status,staff_users(full_name)")
    .gte("work_date", period === "day" ? monthStart : rangeStart)
    .lte("work_date", period === "day" ? date : rangeEnd)
    .order("work_date", { ascending: true })
    .limit(10000);

  if (!organizationScope) {
    dayQuery = dayQuery.eq("user_id", guard.actor.id);
    monthQuery = monthQuery.eq("user_id", guard.actor.id);
  }

  const [dayResult, monthResult] = await Promise.all([dayQuery, monthQuery]);
  if (isMissingAttendanceTable(dayResult.error) || isMissingAttendanceTable(monthResult.error)) {
    return apiError("operation_failed", 503);
  }

  if (dayResult.error || monthResult.error) return apiError("operation_failed", 500);
  const contextStart = period === "day" ? monthStart : rangeStart;
  const contextEnd = period === "day" ? date : rangeEnd;
  const leaveQuery = serverSupabase.from("leave_requests")
    .select("start_date,end_date,start_period,end_period,leave_type,status,requester:staff_users!leave_requests_requester_id_fkey(id,full_name)")
    .eq("status", "approved").lte("start_date", contextEnd).gte("end_date", contextStart).limit(500);
  const onlineQuery = serverSupabase.from("online_work_schedules")
    .select("work_date,staff:staff_users!online_work_schedules_staff_id_fkey(id,full_name)")
    .eq("status", "active").gte("work_date", contextStart).lte("work_date", contextEnd).limit(1000);
  if (!organizationScope) {
    leaveQuery.eq("requester_id", guard.actor.id);
    onlineQuery.eq("staff_id", guard.actor.id);
  }
  const [leaveResult, onlineResult] = await Promise.all([leaveQuery, onlineQuery]);
  if (leaveResult.error || onlineResult.error) return apiError("operation_failed", 500);
  const leaves = (leaveResult.data ?? []) as unknown as Array<{ start_date: string; end_date: string; start_period: string; end_period: string; leave_type: string; requester: { id: string; full_name: string } | null }>;
  const online = (onlineResult.data ?? []) as unknown as Array<{ work_date: string; staff: { id: string; full_name: string } | null }>;
  const foreignStaff = organizationScope
    ? (await serverSupabase.from("staff_users").select("id,full_name,username").eq("active", true).in("username", Object.keys(FOREIGN_REPORTERS))).data ?? []
    : [{ id: guard.actor.id, full_name: guard.actor.full_name, username: guard.actor.username }];
  const foreignById = new Map(foreignStaff.filter((staff) => isForeignReporter(staff.username)).map((staff) => [staff.id, staff]));
  // A blank weekend schedule means the whole foreign-language team works online by default.
  for (const staff of foreignById.values()) {
    for (const cursor = new Date(`${contextStart}T12:00:00Z`); cursor <= new Date(`${contextEnd}T12:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const workDate = cursor.toISOString().slice(0, 10);
      if ([0, 6].includes(cursor.getUTCDay()) && !online.some((row) => row.work_date === workDate && row.staff?.id === staff.id)) {
        online.push({ work_date: workDate, staff: { id: staff.id, full_name: staff.full_name } });
      }
    }
  }
  const leavePeriodsForDate = (leave: typeof leaves[number], workDate: string) => {
    if (leave.start_date === leave.end_date) return [leave.start_period, leave.end_period];
    if (workDate === leave.start_date) return [leave.start_period, leave.start_period];
    if (workDate === leave.end_date) return [leave.end_period, leave.end_period];
    return ["full", "full"];
  };
  const leaveLabel = (leave: typeof leaves[number], workDate: string) => {
    const [startPeriod, endPeriod] = leavePeriodsForDate(leave, workDate);
    const labels = startPeriod === "full" && endPeriod === "full"
      ? { annual: "Nghỉ phép", sick: "Nghỉ ốm", unpaid: "Nghỉ không lương", personal: "Nghỉ việc riêng", business: "Công tác" }
      : { annual: "Nghỉ phép theo buổi", sick: "Nghỉ ốm theo buổi", unpaid: "Nghỉ không lương theo buổi", personal: "Nghỉ việc riêng theo buổi", business: "Công tác theo buổi" };
    return labels[leave.leave_type as keyof typeof labels] ?? (startPeriod === "full" && endPeriod === "full" ? "Nghỉ" : "Nghỉ theo buổi");
  };
  const noteFor = (row: AttendanceRow) => {
    const leave = leaves.find((x) => x.requester?.id === row.user_id && x.start_date <= row.work_date && x.end_date >= row.work_date);
    const onlineDay = online.some((x) => x.work_date === row.work_date && x.staff?.id === row.user_id);
    const parts: string[] = [];
    if (leave) parts.push(leaveLabel(leave, row.work_date));
    const leaveIsFull = !!leave && leavePeriodsForDate(leave, row.work_date).every((period) => period === "full");
    if (onlineDay && !leaveIsFull) parts.push("Làm việc online");
    return parts.join("; ");
  };
  const withNotes = (items: AttendanceRow[]) => items.map((row) => ({ ...row, note: noteFor(row) }));
  const contextRows = (items: AttendanceRow[], from: string, to: string) => {
    const result = withNotes(items);
    const existing = new Set(result.map((row) => `${row.user_id}:${row.work_date}`));
    const dates = (start: string, end: string) => {
      const out: string[] = [];
      for (let cursor = new Date(`${start}T12:00:00Z`); cursor <= new Date(`${end}T12:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) out.push(cursor.toISOString().slice(0, 10));
      return out;
    };
    for (const leave of leaves) {
      if (!leave.requester) continue;
      for (const workDate of dates(leave.start_date < from ? from : leave.start_date, leave.end_date > to ? to : leave.end_date)) {
        const key = `${leave.requester.id}:${workDate}`;
        if (existing.has(key)) continue;
        const label = leaveLabel(leave, workDate);
        result.push({ id: `leave-${leave.requester.id}-${workDate}`, user_id: leave.requester.id, work_date: workDate, check_in: null, check_out: null, note: label, status: "leave", staff_users: { full_name: leave.requester.full_name } });
        existing.add(key);
      }
    }
    for (const onlineRow of online) {
      if (!onlineRow.staff) continue;
      if (onlineRow.work_date < from || onlineRow.work_date > to) continue;
      const key = `${onlineRow.staff.id}:${onlineRow.work_date}`;
      if (existing.has(key)) continue;
      result.push({ id: `online-${onlineRow.staff.id}-${onlineRow.work_date}`, user_id: onlineRow.staff.id, work_date: onlineRow.work_date, check_in: null, check_out: null, note: "Làm việc online", status: "present", staff_users: { full_name: onlineRow.staff.full_name } });
      existing.add(key);
    }
    return result.sort((a, b) => {
      const aLastPunch = a.check_out ?? a.check_in;
      const bLastPunch = b.check_out ?? b.check_in;
      if (aLastPunch && bLastPunch) {
        const byDate = b.work_date.localeCompare(a.work_date);
        if (byDate) return byDate;
        const byLatestPunch = bLastPunch.localeCompare(aLastPunch);
        if (byLatestPunch) return byLatestPunch;
      } else if (aLastPunch) return -1;
      else if (bLastPunch) return 1;
      const byDate = b.work_date.localeCompare(a.work_date);
      if (byDate) return byDate;
      return (a.staff_users?.full_name ?? "").localeCompare(b.staff_users?.full_name ?? "", "vi");
    });
  };
  return apiJson({
    scope: organizationScope ? "organization" : "personal",
    demo: false,
    rows: contextRows((dayResult.data ?? []) as unknown as AttendanceRow[], rangeStart, rangeEnd),
    monthlyRows: contextRows((monthResult.data ?? []) as unknown as AttendanceRow[], period === "day" ? monthStart : rangeStart, period === "day" ? date : rangeEnd),
    message: `Đã tải ${(dayResult.data ?? []).length} bản ghi theo ${period === "day" ? "ngày" : period === "week" ? "tuần" : "tháng"}.`,
  });
}
