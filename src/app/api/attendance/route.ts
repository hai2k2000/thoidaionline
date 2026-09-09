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
  work_date: string;
  check_in: string | null;
  check_out: string | null;
  note: string | null;
  status: string | null;
  staff_users?: { full_name: string } | null;
};

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
    .select("id,work_date,check_in,check_out,note,status,staff_users(full_name)")
    .gte("work_date", rangeStart)
    .lte("work_date", rangeEnd)
    .order("check_in", { ascending: true, nullsFirst: false })
    .limit(500);
  let monthQuery = serverSupabase
    .from("attendance_logs")
    .select("id,work_date,check_in,check_out,note,status,staff_users(full_name)")
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
  return apiJson({
    scope: organizationScope ? "organization" : "personal",
    demo: false,
    rows: (dayResult.data ?? []) as unknown as AttendanceRow[],
    monthlyRows: (monthResult.data ?? []) as unknown as AttendanceRow[],
    message: `Đã tải ${(dayResult.data ?? []).length} bản ghi theo ${period === "day" ? "ngày" : period === "week" ? "tuần" : "tháng"}.`,
  });
}
