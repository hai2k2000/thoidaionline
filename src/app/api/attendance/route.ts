import { apiError, apiJson, requireReadActor } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type DemoUser = {
  id: string;
  full_name: string;
  active: boolean;
  roles?: { code?: string | null } | Array<{ code?: string | null }> | null;
};

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

const roleCode = (user: DemoUser) => {
  const role = Array.isArray(user.roles) ? user.roles[0] : user.roles;
  return role?.code ?? "";
};

const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`;

const generateDemoDayRows = (users: DemoUser[], date: string): AttendanceRow[] => users.map((user, index) => ({
  id: `demo-${user.id}-${date}`,
  user_id: user.id,
  work_date: date,
  check_in: toTime(8 * 60 + 2 + (index % 35)),
  check_out: toTime(17 * 60 + 8 + (index % 40)),
  note: "[DEMO] Chấm công mẫu",
  status: "Có mặt",
  staff_users: { full_name: user.full_name },
}));

const generateDemoRangeRows = (users: DemoUser[], fromDate: string, toDate: string): AttendanceRow[] => {
  const from = new Date(`${fromDate}T12:00:00Z`);
  const to = new Date(`${toDate}T12:00:00Z`);
  const rows: AttendanceRow[] = [];
  for (const date = new Date(from); date <= to; date.setUTCDate(date.getUTCDate() + 1)) {
    if (date.getUTCDay() === 0) continue;
    rows.push(...generateDemoDayRows(users, date.toISOString().slice(0, 10)));
  }
  return rows;
};

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
    const usersResult = await serverSupabase
      .from("staff_users")
      .select("id,full_name,active,roles(code)")
      .eq("active", true)
      .order("full_name", { ascending: true });
    if (usersResult.error) return apiError("operation_failed", 500);

    let users = (usersResult.data ?? []) as unknown as DemoUser[];
    users = users.filter((user) => roleCode(user) !== "tong_bien_tap");
    if (!organizationScope) users = users.filter((user) => user.id === guard.actor.id);
    return apiJson({
      scope: organizationScope ? "organization" : "personal",
      demo: true,
      rows: generateDemoRangeRows(users, rangeStart, rangeEnd),
      monthlyRows: generateDemoRangeRows(users, monthStart, period === "day" ? date : rangeEnd),
      message: `Đã nạp dữ liệu DEMO chấm công cho ${users.length} nhân sự (trừ Tổng biên tập).`,
    });
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
  const noteFor = (row: AttendanceRow) => {
    const leave = leaves.find((x) => x.requester?.id === row.user_id && x.start_date <= row.work_date && x.end_date >= row.work_date);
    const onlineDay = online.some((x) => x.work_date === row.work_date && x.staff?.id === row.user_id);
    const parts: string[] = [];
    if (leave) parts.push(leave.start_period === "full" && leave.end_period === "full" ? ({ annual: "Nghỉ phép", sick: "Nghỉ ốm", unpaid: "Nghỉ không lương", personal: "Nghỉ việc riêng", business: "Công tác" }[leave.leave_type] ?? "Nghỉ") : "Nghỉ phép theo buổi");
    const leaveIsFull = !!leave && leave.start_period === "full" && leave.end_period === "full";
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
        const label = leave.start_period === "full" && leave.end_period === "full" ? ({ annual: "Nghỉ phép", sick: "Nghỉ ốm", unpaid: "Nghỉ không lương", personal: "Nghỉ việc riêng", business: "Công tác" }[leave.leave_type] ?? "Nghỉ") : "Nghỉ phép theo buổi";
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
      const byDate = a.work_date.localeCompare(b.work_date);
      if (byDate) return byDate;
      if (a.check_in && b.check_in) {
        const byCheckIn = a.check_in.localeCompare(b.check_in);
        if (byCheckIn) return byCheckIn;
      } else if (a.check_in) return -1;
      else if (b.check_in) return 1;
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
