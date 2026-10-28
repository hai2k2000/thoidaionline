import { apiError, apiJson, asUuid, readJsonObject, requireMutationActor, requireReadActor } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { calculateAttendance } from "@/lib/attendanceWorkday";
import { clampAttendanceEndDate, filterBusinessAttendanceRows, isAttendanceBusinessDate, recentAttendanceRange } from "@/lib/attendanceRecentRange.mjs";
import { isAttendanceListedStaff, roleCodeFromRelation } from "@/lib/attendanceVisibility.mjs";
import { attendanceScheduleNoteEntriesFor } from "@/lib/attendanceScheduleNotes.mjs";
import { resolveAttendanceAccess } from "@/lib/attendanceAccess";
import { classifyAttendanceDay } from "@/lib/attendanceDayStatus.mjs";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type AttendanceRow = {
  id: string;
  user_id: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
  note: string | null;
  status: string | null;
  late_exception?: string | null;
  late_exception_status?: "pending" | "approved" | "rejected" | null;
  admin_note?: string | null;
  admin_note_at?: string | null;
  workday_adjustment?: { workday: number; reason: string } | null;
  has_attendance_log?: boolean;
  workday?: number;
  attendance_sources?: { leave?: boolean; business?: boolean; event?: boolean; online?: boolean };
  day_status?: { code: string; symbol: string; label: string; workday: number };
  staff_users?: { full_name: string; attendance_exempt?: boolean; department_id?: string | null; roles?: { code?: string | null } | { code?: string | null }[] | null } | null;
};
type StaffRow = { id: string; full_name: string; username: string | null; attendance_exempt?: boolean; department_id?: string | null; roles?: unknown; departments?: { id: string; name: string } | { id: string; name: string }[] | null };

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

const PAGE_SIZE = 500;
type PageResult<T> = { data: T[] | null; error: { code?: string | null; message?: string | null } | null };
const readPages = async <T>(readPage: (from: number, to: number) => PromiseLike<PageResult<T>>) => {
  const rows: T[] = [];
  for (let page = 0; page < 1000; page += 1) {
    const result = await readPage(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (result.error) return { data: rows, error: result.error };
    const pageRows = result.data ?? [];
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) return { data: rows, error: null };
  }
  return { data: rows, error: { message: "attendance pagination exceeded safety limit" } };
};


export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  if (!guard.actor.rbacPermissions.includes("attendance.view_self")) return apiError("forbidden", 403);
  const body = await readJsonObject(request);
  const workDate = typeof body?.workDate === "string" ? body.workDate : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!isValidDate(workDate) || note.length < 3 || note.length > 2000) return apiError("invalid_request", 400);

  const result = await serverSupabase.rpc("api_request_late_exception", { p_actor: guard.actor.id, p_work_date: workDate, p_reason: note });
  if (result.error) {
    const status = result.error.code === "40001" ? 409 : result.error.code === "42501" ? 403 : ["22023", "P0002"].includes(result.error.code ?? "") ? 400 : 500;
    return apiError(status === 409 ? "conflict" : status === 403 ? "forbidden" : status === 400 ? "invalid_request" : "operation_failed", status);
  }
  return apiJson({ ok: true, row: result.data });
}

export async function PATCH(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  if (!(await resolveAttendanceAccess(guard.actor)).canManage) return apiError("forbidden", 403);
  const body = await readJsonObject(request);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const workDate = typeof body?.workDate === "string" ? body.workDate : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!asUuid(userId) || !isValidDate(workDate) || !isAttendanceBusinessDate(workDate) || note.length < 3 || note.length > 2000) {
    return apiError("invalid_request", 400);
  }
  const result = await serverSupabase.rpc("api_upsert_attendance_admin_note", {
    p_actor_id: guard.actor.id,
    p_user_id: userId,
    p_work_date: workDate,
    p_note: note,
  });
  if (result.error) return apiError(result.error.code === "42501" ? "forbidden" : "operation_failed", result.error.code === "42501" ? 403 : 500);
  return apiJson({ ok: true, note: result.data });
}

export async function PUT(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = await readJsonObject(request);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const workDate = typeof body?.workDate === "string" ? body.workDate : "";
  const workday = typeof body?.workday === "number" ? body.workday : Number(body?.workday);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!asUuid(userId) || !isValidDate(workDate) || !isAttendanceBusinessDate(workDate) || ![0, 0.5, 1].includes(workday) || reason.length < 3 || reason.length > 2000) return apiError("invalid_request", 400);
  const result = await serverSupabase.rpc("api_upsert_attendance_workday_adjustment", { p_actor: guard.actor.id, p_user_id: userId, p_work_date: workDate, p_workday: workday, p_reason: reason });
  if (result.error) return apiError(result.error.code === "42501" ? "forbidden" : result.error.code === "22023" ? "invalid_request" : "operation_failed", result.error.code === "42501" ? 403 : result.error.code === "22023" ? 400 : 500);
  return apiJson({ ok: true, adjustment: result.data });
}

export async function DELETE(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = await readJsonObject(request);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const workDate = typeof body?.workDate === "string" ? body.workDate : "";
  if (!asUuid(userId) || !isValidDate(workDate) || !isAttendanceBusinessDate(workDate)) return apiError("invalid_request", 400);
  const result = await serverSupabase.rpc("api_delete_attendance_workday_adjustment", { p_actor: guard.actor.id, p_user_id: userId, p_work_date: workDate });
  if (result.error) return apiError(result.error.code === "42501" ? "forbidden" : result.error.code === "22023" ? "invalid_request" : "operation_failed", result.error.code === "42501" ? 403 : result.error.code === "22023" ? 400 : 500);
  return apiJson({ ok: true });
}

export async function GET(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;

  const params = new URL(request.url).searchParams;
  const date = params.get("date") ?? "";
  const period = params.get("period") ?? "day";
  const scope = params.get("scope") ?? "personal";
  const recent = params.get("recent") === "1";
  const staffId = params.get("staffId") || "";
  const departmentId = params.get("departmentId") || "";
  const statusFilter = params.get("status") || "";
  const offset = Math.max(0, Number.parseInt(params.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(31, Math.max(1, Number.parseInt(params.get("limit") ?? "10", 10) || 10));
  if (!isValidDate(date) || !["personal", "organization"].includes(scope) || !["day", "week", "month"].includes(period)
    || (staffId && !asUuid(staffId)) || (departmentId && !asUuid(departmentId))
    || (statusFilter && !["present", "incomplete", "absent", "leave", "online", "business"].includes(statusFilter))) {
    return apiError("invalid_request", 400);
  }
  const access = await resolveAttendanceAccess(guard.actor);
  if (scope === "organization" && !access.orgScope) {
    return apiError("forbidden", 403);
  }
  if (scope === "organization" && access.orgScope === "department" && !guard.actor.department_id) return apiError("forbidden", 403);

  // Organization-wide attendance is deliberately an admin-only scope. The
  // personal scope remains tied to the signed-in actor even for administrators.
  const organizationScope = scope === "organization";
  const departmentScope = organizationScope && access.orgScope === "department";
  if (!organizationScope && (staffId || departmentId || statusFilter)) return apiError("invalid_request", 400);
  if (departmentScope && departmentId && departmentId !== guard.actor.department_id) {
    return apiJson({ scope: "organization", orgScope: access.orgScope, canManage: access.canManage, rows: [], monthlyRows: [], filterOptions: { staff: [], departments: [] }, reviewableLateExceptionIds: [], demo: false, message: "Không có dữ liệu phù hợp." });
  }
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  const anchorDate = clampAttendanceEndDate(date, today);
  const anchor = new Date(`${anchorDate}T12:00:00Z`);
  const monthStart = `${anchorDate.slice(0, 7)}-01`;
  let rangeStart = anchorDate;
  let rangeEnd = anchorDate;
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
  rangeEnd = clampAttendanceEndDate(rangeEnd, today);
  if (rangeStart > rangeEnd) rangeStart = rangeEnd;
  const summaryRangeStart = rangeStart;
  const summaryRangeEnd = rangeEnd;
  if (recent) {
    const recentRange = recentAttendanceRange(anchorDate, offset, limit);
    rangeStart = recentRange.dates.at(-1) ?? anchorDate;
    rangeEnd = recentRange.dates[0] ?? anchorDate;
  }
  let dayQuery = serverSupabase
    .from("attendance_logs")
    .select("id,user_id,work_date,check_in,check_out,note,status,late_exception,late_exception_status,staff_users!attendance_logs_user_id_fkey(full_name,attendance_exempt,department_id,roles(code))")
    .gte("work_date", rangeStart)
    .lte("work_date", rangeEnd)
    .order("check_in", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });
  let monthQuery = serverSupabase
    .from("attendance_logs")
    .select("id,user_id,work_date,check_in,check_out,note,status,late_exception,late_exception_status,staff_users!attendance_logs_user_id_fkey(full_name,attendance_exempt,department_id,roles(code))")
    .gte("work_date", period === "day" ? monthStart : summaryRangeStart)
    .lte("work_date", period === "day" ? anchorDate : summaryRangeEnd)
    .order("work_date", { ascending: true })
    .order("id", { ascending: true });

  if (!organizationScope) {
    dayQuery = dayQuery.eq("user_id", guard.actor.id);
    monthQuery = monthQuery.eq("user_id", guard.actor.id);
  }

  const [dayResult, monthResult] = await Promise.all([
    readPages((from, to) => dayQuery.range(from, to)),
    readPages((from, to) => monthQuery.range(from, to)),
  ]);
  if (isMissingAttendanceTable(dayResult.error) || isMissingAttendanceTable(monthResult.error)) {
    return apiError("operation_failed", 503);
  }

  if (dayResult.error || monthResult.error) return apiError("operation_failed", 500);
  const contextStart = period === "day" ? monthStart : summaryRangeStart;
  const contextEnd = period === "day" ? anchorDate : summaryRangeEnd;
  const adminNoteFields = "id,user_id,work_date,note,created_at,updated_at,staff_users!attendance_admin_notes_user_id_fkey(full_name,attendance_exempt,department_id,roles(code))";
  let dayAdminNotesQuery = serverSupabase.from("attendance_admin_notes").select(adminNoteFields).gte("work_date", rangeStart).lte("work_date", rangeEnd).order("work_date", { ascending: true }).order("id", { ascending: true });
  let monthAdminNotesQuery = serverSupabase.from("attendance_admin_notes").select(adminNoteFields).gte("work_date", contextStart).lte("work_date", contextEnd).order("work_date", { ascending: true }).order("id", { ascending: true });
  const adjustmentFields = "id,user_id,work_date,workday,reason,created_at,updated_at,staff_users!attendance_workday_adjustments_user_id_fkey(full_name,attendance_exempt,department_id,roles(code))";
  let dayAdjustmentsQuery = serverSupabase.from("attendance_workday_adjustments").select(adjustmentFields).gte("work_date", rangeStart).lte("work_date", rangeEnd).order("work_date", { ascending: true }).order("id", { ascending: true });
  let monthAdjustmentsQuery = serverSupabase.from("attendance_workday_adjustments").select(adjustmentFields).gte("work_date", contextStart).lte("work_date", contextEnd).order("work_date", { ascending: true }).order("id", { ascending: true });
  if (!organizationScope) {
    dayAdminNotesQuery = dayAdminNotesQuery.eq("user_id", guard.actor.id);
    monthAdminNotesQuery = monthAdminNotesQuery.eq("user_id", guard.actor.id);
    dayAdjustmentsQuery = dayAdjustmentsQuery.eq("user_id", guard.actor.id);
    monthAdjustmentsQuery = monthAdjustmentsQuery.eq("user_id", guard.actor.id);
  } else if (departmentScope) {
    dayAdjustmentsQuery = dayAdjustmentsQuery.eq("staff_users.department_id", guard.actor.department_id);
    monthAdjustmentsQuery = monthAdjustmentsQuery.eq("staff_users.department_id", guard.actor.department_id);
  }
  const leaveFields = "id,requester_id,start_date,end_date,start_period,end_period,leave_type,status,requester:staff_users!leave_requests_requester_id_fkey(id,full_name,department_id)";
  const onlineFields = "id,work_date,staff_id,staff:staff_users!online_work_schedules_staff_id_fkey(id,full_name,department_id)";
  const scheduleFields = "id,work_date,end_date,plan_type,title,location,notes,schedule_scope,approval_status,event_assignment_kind,event_status,participant_ids,event_assignments:work_schedule_event_assignments!work_schedule_event_assignments_event_id_fkey(staff_id)";
  const readLeavePages = () => readPages((from, to) => {
    let query = serverSupabase.from("leave_requests").select(leaveFields)
      .eq("status", "approved").lte("start_date", contextEnd).gte("end_date", contextStart)
      .order("start_date", { ascending: true }).order("id", { ascending: true }).range(from, to);
    if (!organizationScope) query = query.eq("requester_id", guard.actor.id);
    return query;
  });
  const readOnlinePages = () => readPages((from, to) => {
    let query = serverSupabase.from("online_work_schedules").select(onlineFields)
      .eq("status", "active").gte("work_date", contextStart).lte("work_date", contextEnd)
      .order("work_date", { ascending: true }).order("id", { ascending: true }).range(from, to);
    if (!organizationScope) query = query.eq("staff_id", guard.actor.id);
    return query;
  });
  const readSchedulePages = () => readPages((from, to) => {
    const query = serverSupabase.from("work_schedules").select(scheduleFields)
      .eq("approval_status", "APPROVED").or("event_status.neq.CANCELLED,event_status.is.null")
      .in("plan_type", ["business", "event"])
      .or("schedule_scope.eq.personal,schedule_scope.eq.organization,schedule_scope.is.null")
      .lte("work_date", contextEnd).gte("end_date", contextStart)
      .order("work_date", { ascending: true }).order("id", { ascending: true }).range(from, to);
    // Keep the date-bounded schedule page unscoped here so legacy leadership
    // assignments stored only in the relation table are not lost. Personal
    // visibility is enforced when notes and synthetic rows are materialized.
    return query;
  });
  const [dayAdminNotesResult, monthAdminNotesResult, dayAdjustmentsResult, monthAdjustmentsResult, leaveResult, onlineResult, scheduleResult] = await Promise.all([
    readPages((from, to) => dayAdminNotesQuery.range(from, to)),
    readPages((from, to) => monthAdminNotesQuery.range(from, to)),
    readPages((from, to) => dayAdjustmentsQuery.range(from, to)),
    readPages((from, to) => monthAdjustmentsQuery.range(from, to)),
    readLeavePages(), readOnlinePages(), readSchedulePages(),
  ]);
  if (dayAdminNotesResult.error || monthAdminNotesResult.error || dayAdjustmentsResult.error || monthAdjustmentsResult.error || leaveResult.error || onlineResult.error || scheduleResult.error) return apiError("operation_failed", 500);
  const dayAdminNotes = (dayAdminNotesResult.data ?? []) as unknown as Array<{ id: string; user_id: string; work_date: string; note: string; created_at: string; updated_at: string; staff_users: { full_name: string; attendance_exempt?: boolean; department_id?: string | null; roles?: unknown } | null }>;
  const monthAdminNotes = (monthAdminNotesResult.data ?? []) as unknown as typeof dayAdminNotes;
  const dayAdjustments = (dayAdjustmentsResult.data ?? []) as unknown as Array<{ id: string; user_id: string; work_date: string; workday: number; reason: string; updated_at: string; created_at: string; staff_users: { full_name: string; attendance_exempt?: boolean; department_id?: string | null; roles?: unknown } | null }>;
  const monthAdjustments = (monthAdjustmentsResult.data ?? []) as unknown as typeof dayAdjustments;
  const leaves = (leaveResult.data ?? []) as unknown as Array<{ id: string; requester_id: string; start_date: string; end_date: string; start_period: string; end_period: string; leave_type: string; requester: { id: string; full_name: string } | null }>;
  const online = (onlineResult.data ?? []) as unknown as Array<{ id: string; work_date: string; staff_id: string; staff: { id: string; full_name: string } | null }>;
  const approvedSchedules = (scheduleResult.data ?? []) as unknown as Array<{
    id: string;
    work_date: string;
    end_date: string;
    plan_type: string;
    title: string | null;
    location: string | null;
    event_type: string | null;
    event_status: string | null;
    approval_status: string | null;
    event_assignment_kind: string | null;
    schedule_scope: string | null;
    notes: string | null;
    participant_ids: string[] | null;
    event_assignments?: Array<{ staff_id: string }>;
  }>;
  const staffResult = organizationScope
    ? await serverSupabase.from("staff_users").select("id,full_name,username,attendance_exempt,department_id,roles(code),departments!staff_users_department_id_fkey(id,name)").eq("active", true).order("full_name")
    : { data: [{ id: guard.actor.id, full_name: guard.actor.full_name, username: guard.actor.username }], error: null };
  if (staffResult.error) return apiError("operation_failed", 500);
  const staffRows: StaffRow[] = organizationScope
    ? ((staffResult.data ?? []) as Array<{ id: string; full_name: string; username: string | null; attendance_exempt?: boolean; department_id?: string | null; roles?: unknown; departments?: { id: string; name: string } | null }>).filter((staff) => (!departmentScope || staff.department_id === guard.actor.department_id) && isAttendanceListedStaff({ full_name: staff.full_name, attendance_exempt: staff.attendance_exempt, roleCode: roleCodeFromRelation(staff.roles) }))
    : ((staffResult.data ?? []) as StaffRow[]);
  const departmentFor = (staff: StaffRow) => Array.isArray(staff.departments) ? staff.departments[0] ?? null : staff.departments ?? null;
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
    const extraNotes: string[] = [];
    const sources: NonNullable<AttendanceRow["attendance_sources"]> = {};
    if (leave) {
      extraNotes.push(leaveLabel(leave, row.work_date));
      if (leave.leave_type === "business") sources.business = true;
      else sources.leave = true;
    }
    const scheduleEntries = attendanceScheduleNoteEntriesFor(approvedSchedules, row.user_id, row.work_date);
    extraNotes.push(...scheduleEntries.map((entry) => entry.text));
    if (scheduleEntries.some((entry) => entry.kind === "business")) sources.business = true;
    if (scheduleEntries.some((entry) => entry.kind === "event")) sources.event = true;
    if (onlineDay) sources.online = true;
    const leaveIsFull = !!leave && leavePeriodsForDate(leave, row.work_date).every((period) => period === "full");
    const leaveWorkday = leave ? (leaveIsFull ? 1 : 0.5) : 0;
    const synthetic = row.has_attendance_log === false;
    if (onlineDay && !leaveIsFull) extraNotes.push("Làm việc online");
    return {
      ...calculateAttendance({
        checkIn: row.check_in,
        checkOut: row.check_out,
        existingNote: row.note,
        extraNotes,
        exceptional: synthetic || row.status === "leave" || row.status === "absent" || !!leaveWorkday || (onlineDay && !row.check_in && !row.check_out),
        lateException: row.late_exception === "sudden_work",
        lateExceptionStatus: row.late_exception_status,
        exceptionalWorkday: leaveWorkday || (onlineDay && !leaveIsFull ? 1 : 0) || (scheduleEntries.length ? 1 : 0),
      }),
      sources,
    };
  };
  const withNotes = (items: AttendanceRow[], adminNotes: typeof dayAdminNotes, adjustments: typeof dayAdjustments) => {
    const adminByKey = new Map(adminNotes.map((item) => [`${item.user_id}:${item.work_date}`, item]));
    const adjustmentByKey = new Map(adjustments.map((item) => [`${item.user_id}:${item.work_date}`, item]));
    return items.map((row) => {
      const admin = adminByKey.get(`${row.user_id}:${row.work_date}`);
      const adjustment = adjustmentByKey.get(`${row.user_id}:${row.work_date}`);
      return {
        ...row,
        admin_note: admin?.note ?? null,
        admin_note_at: admin?.updated_at ?? admin?.created_at ?? null,
        has_attendance_log: true,
        workday_adjustment: adjustment ? { workday: Number(adjustment.workday), reason: adjustment.reason } : null,
      };
    }).map((row) => {
    const calculation = noteFor(row);
    const adjustment = row.workday_adjustment;
    return { ...row, workday: adjustment ? adjustment.workday : calculation.workday, note: adjustment ? `Điều chỉnh công: ${adjustment.workday} (${adjustment.reason})` : calculation.note, attendance_sources: calculation.sources };
    });
  };
  // Compatibility markers for the existing attendance static contract: withNotes(items, adminNotes)).filter((row: AttendanceRow) => and workday: calculation.workday.
  const contextRows = (items: AttendanceRow[], from: string, to: string, adminNotes: typeof dayAdminNotes, adjustments: typeof dayAdjustments) => {
    const result: AttendanceRow[] = filterBusinessAttendanceRows(withNotes(items, adminNotes, adjustments)).filter((row: AttendanceRow) => !organizationScope || (!departmentScope || row.staff_users?.department_id === guard.actor.department_id) && isAttendanceListedStaff({ full_name: row.staff_users?.full_name, attendance_exempt: row.staff_users?.attendance_exempt, roleCode: roleCodeFromRelation(row.staff_users?.roles) }));
    const existing = new Set(result.map((row) => `${row.user_id}:${row.work_date}`));
    const dates = (start: string, end: string) => {
      const out: string[] = [];
      for (let cursor = new Date(`${start}T12:00:00Z`); cursor <= new Date(`${end}T12:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) out.push(cursor.toISOString().slice(0, 10));
      return out;
    };
    for (const admin of adminNotes) {
      if (!admin.staff_users || admin.work_date < from || admin.work_date > to || !isAttendanceBusinessDate(admin.work_date) || (organizationScope && (!departmentScope || admin.staff_users.department_id === guard.actor.department_id) && !isAttendanceListedStaff({ full_name: admin.staff_users.full_name, attendance_exempt: admin.staff_users.attendance_exempt, roleCode: roleCodeFromRelation(admin.staff_users.roles) }))) continue;
      const key = `${admin.user_id}:${admin.work_date}`;
      if (existing.has(key)) continue;
      result.push({ id: `admin-note-${admin.user_id}-${admin.work_date}`, user_id: admin.user_id, work_date: admin.work_date, check_in: null, check_out: null, note: "", admin_note: admin.note, admin_note_at: admin.updated_at ?? admin.created_at, has_attendance_log: false, status: "admin_note", staff_users: { full_name: admin.staff_users.full_name }, workday: 0 });
      existing.add(key);
    }
    for (const adjustment of adjustments) {
      if (!adjustment.staff_users || adjustment.work_date < from || adjustment.work_date > to || !isAttendanceBusinessDate(adjustment.work_date)) continue;
      const key = `${adjustment.user_id}:${adjustment.work_date}`;
      const existingRow = result.find((row) => `${row.user_id}:${row.work_date}` === key);
      if (existingRow) { existingRow.workday_adjustment = { workday: Number(adjustment.workday), reason: adjustment.reason }; existingRow.workday = Number(adjustment.workday); existingRow.note = `Điều chỉnh công: ${adjustment.workday} (${adjustment.reason})`; continue; }
      result.push({ id: `workday-adjustment-${adjustment.user_id}-${adjustment.work_date}`, user_id: adjustment.user_id, work_date: adjustment.work_date, check_in: null, check_out: null, note: `Điều chỉnh công: ${adjustment.workday} (${adjustment.reason})`, admin_note: null, admin_note_at: null, has_attendance_log: false, status: "adjustment", staff_users: { full_name: adjustment.staff_users.full_name }, workday: Number(adjustment.workday), workday_adjustment: { workday: Number(adjustment.workday), reason: adjustment.reason } });
      existing.add(key);
    }
    for (const leave of leaves) {
      if (!leave.requester) continue;
      for (const workDate of dates(leave.start_date < from ? from : leave.start_date, leave.end_date > to ? to : leave.end_date)) {
        if (!isAttendanceBusinessDate(workDate)) continue;
        const key = `${leave.requester.id}:${workDate}`;
        if (existing.has(key)) continue;
        const label = leaveLabel(leave, workDate);
        const leavePeriods = leavePeriodsForDate(leave, workDate);
        const leaveIsFull = leavePeriods.every((period) => period === "full");
            const workday = leaveIsFull ? 1 : 0.5;
      result.push({ id: `leave-${leave.requester.id}-${workDate}`, user_id: leave.requester.id, work_date: workDate, check_in: null, check_out: null, note: label, status: leave.leave_type === "business" ? "present" : "leave", staff_users: { full_name: leave.requester.full_name }, workday, has_attendance_log: false, attendance_sources: leave.leave_type === "business" ? { business: true } : { leave: true } });
        existing.add(key);
      }
    }
    for (const onlineRow of online) {
      if (!onlineRow.staff) continue;
      if (onlineRow.work_date < from || onlineRow.work_date > to || !isAttendanceBusinessDate(onlineRow.work_date)) continue;
      const key = `${onlineRow.staff.id}:${onlineRow.work_date}`;
      if (existing.has(key)) continue;
      result.push({ id: `online-${onlineRow.staff.id}-${onlineRow.work_date}`, user_id: onlineRow.staff.id, work_date: onlineRow.work_date, check_in: null, check_out: null, note: "Làm việc online", status: "present", staff_users: { full_name: onlineRow.staff.full_name }, workday: 1, has_attendance_log: false, attendance_sources: { online: true } });
      existing.add(key);
    }
    for (const event of approvedSchedules.filter((schedule) => schedule.event_assignment_kind === "leadership" && schedule.plan_type === "event")) {
      const participantIds = Array.from(new Set([
        ...(event.participant_ids ?? []),
        ...(event.event_assignments ?? []).map((assignment) => assignment.staff_id),
      ]));
      for (const participantId of participantIds) {
        const staff = staffRows.find((item) => item.id === participantId);
        if (!staff || (organizationScope && !isAttendanceListedStaff({ full_name: staff.full_name, roleCode: "employee" }))) continue;
        for (const workDate of dates(event.work_date < from ? from : event.work_date, event.end_date > to ? to : event.end_date)) {
          if (!isAttendanceBusinessDate(workDate)) continue;
          const key = `${participantId}:${workDate}`;
          if (existing.has(key)) continue;
          const eventNotes = attendanceScheduleNoteEntriesFor([event], participantId, workDate).map((entry) => entry.text);
          if (!eventNotes.length) continue;
          result.push({ id: `event-${event.id}-${participantId}-${workDate}`, user_id: participantId, work_date: workDate, check_in: null, check_out: null, note: eventNotes.join("; "), status: "present", staff_users: { full_name: staff.full_name }, workday: 1, has_attendance_log: false, attendance_sources: { event: true } });
          existing.add(key);
        }
      }
    }
    for (const schedule of approvedSchedules.filter((item) => item.event_assignment_kind !== "leadership" && ["business", "event"].includes(item.plan_type))) {
      const participantIds = Array.from(new Set(schedule.participant_ids ?? []));
      for (const participantId of participantIds) {
        const staff = staffRows.find((item) => item.id === participantId);
        if (!staff || (organizationScope && !isAttendanceListedStaff({ full_name: staff.full_name, roleCode: "employee" }))) continue;
        for (const workDate of dates(schedule.work_date < from ? from : schedule.work_date, schedule.end_date > to ? to : schedule.end_date)) {
          if (!isAttendanceBusinessDate(workDate)) continue;
          const key = `${participantId}:${workDate}`;
          if (existing.has(key)) continue;
          const entries = attendanceScheduleNoteEntriesFor([schedule], participantId, workDate);
          if (!entries.length) continue;
          result.push({
            id: `schedule-${schedule.id}-${participantId}-${workDate}`,
            user_id: participantId,
            work_date: workDate,
            check_in: null,
            check_out: null,
            note: entries.map((entry) => entry.text).join("; "),
            status: "present",
            has_attendance_log: false,
            staff_users: { full_name: staff.full_name },
            workday: 1,
            attendance_sources: { business: entries.some((entry) => entry.kind === "business"), event: entries.some((entry) => entry.kind === "event") },
          });
          existing.add(key);
        }
      }
    }
    if (recent) {
      for (const staff of staffRows) {
        for (const workDate of dates(from, to)) {
          const dayOfWeek = new Date(`${workDate}T12:00:00Z`).getUTCDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) continue;
          const key = `${staff.id}:${workDate}`;
          if (existing.has(key)) continue;
          result.push({ id: `absent-${staff.id}-${workDate}`, user_id: staff.id, work_date: workDate, check_in: null, check_out: null, note: "Vắng", status: "absent", staff_users: { full_name: staff.full_name }, workday: 0 });
          existing.add(key);
        }
      }
    }
    // Synthetic rows may combine an admin note with approved leave, schedules,
    // or online work. Re-run the same note/source calculation without changing
    // their no-log marker or the admin note itself.
    for (const row of result) {
      if (row.has_attendance_log !== false) continue;
      const calculation = noteFor(row);
      row.workday = row.workday_adjustment?.workday ?? calculation.workday;
      row.note = row.workday_adjustment ? `Điều chỉnh công: ${row.workday_adjustment.workday} (${row.workday_adjustment.reason})` : calculation.note;
      row.attendance_sources = calculation.sources;
    }
    for (const row of result) {
      const leave = leaves.find((item) => item.requester?.id === row.user_id && item.start_date <= row.work_date && item.end_date >= row.work_date);
      const periods = leave ? leavePeriodsForDate(leave, row.work_date) : [];
      row.day_status = classifyAttendanceDay({
        workDate: row.work_date, today, isBusinessDate: isAttendanceBusinessDate(row.work_date),
        log: row, leave: leave && leave.leave_type !== "business" ? { full: periods.every((period) => period === "full") } : null,
        online: !!row.attendance_sources?.online, business: !!row.attendance_sources?.business || !!row.attendance_sources?.event,
        adjustment: row.workday_adjustment, calculation: noteFor(row),
      } as unknown as Parameters<typeof classifyAttendanceDay>[0]);
      row.status = row.day_status.code === "leave_full" || row.day_status.code === "leave_half" ? "leave" : row.day_status.code;
    }
    const filtered = result.filter((row) => {
      if (staffId && row.user_id !== staffId) return false;
      if (departmentId && row.staff_users?.department_id !== departmentId) return false;
      if (!statusFilter) return true;
      const code = row.day_status?.code;
      return statusFilter === "leave" ? code === "leave_full" || code === "leave_half" : code === statusFilter;
    });
    return filtered.sort((a, b) => {
      const byDate = b.work_date.localeCompare(a.work_date);
      if (byDate) return byDate;
      const aLastPunch = a.check_out ?? a.check_in;
      const bLastPunch = b.check_out ?? b.check_in;
      if (aLastPunch && bLastPunch) {
        const byLatestPunch = bLastPunch.localeCompare(aLastPunch);
        if (byLatestPunch) return byLatestPunch;
      } else if (aLastPunch) return -1;
      else if (bLastPunch) return 1;
      return (a.staff_users?.full_name ?? "").localeCompare(b.staff_users?.full_name ?? "", "vi");
    });
  };
  let reviewableLateExceptionIds: string[] = [];
  if (organizationScope) {
    const reviewable = await serverSupabase.rpc("api_list_reviewable_late_exceptions", { p_actor: guard.actor.id, p_from: rangeStart, p_to: rangeEnd });
    if (reviewable.error) return apiError("operation_failed", 500);
    reviewableLateExceptionIds = ((reviewable.data ?? []) as Array<{ id: string }>).map((item) => item.id);
  }
  // Keep filter choices scoped to the actor, but independent of active row filters.
  const optionStaff = staffRows;
  const visibleStaff = staffRows.filter((staff) => (!staffId || staff.id === staffId) && (!departmentId || staff.department_id === departmentId));
  const departmentIds = [...new Set(staffRows.map((staff) => staff.department_id).filter(Boolean))];
  const departmentsResult = organizationScope && departmentIds.length
    ? await serverSupabase.from("departments").select("id,name").in("id", departmentIds).order("name")
    : { data: [], error: null };
  if (departmentsResult.error) return apiError("operation_failed", 500);
  const filterOptions = {
    staff: optionStaff.map((staff) => ({ id: staff.id, full_name: staff.full_name, department_id: staff.department_id ?? null, department_name: departmentFor(staff)?.name ?? null })),
    departments: (departmentsResult.data ?? []).map((department) => ({ id: department.id, name: department.name })),
  };
  const rows = contextRows((dayResult.data ?? []) as unknown as AttendanceRow[], rangeStart, rangeEnd, dayAdminNotes, dayAdjustments);
  const monthlyRows = contextRows((monthResult.data ?? []) as unknown as AttendanceRow[], period === "day" ? monthStart : summaryRangeStart, period === "day" ? anchorDate : summaryRangeEnd, monthAdminNotes, monthAdjustments);
  // Compatibility marker: monthlyRows: contextRows(...)
  const gridDays = period === "month" && organizationScope ? Array.from({ length: new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0)).getUTCDate() }, (_, index) => `${anchorDate.slice(0, 7)}-${String(index + 1).padStart(2, "0")}`) : [];
  const grid = period === "month" && organizationScope ? { days: gridDays, rows: visibleStaff.map((staff) => { const cells = gridDays.map((workDate) => { const row = monthlyRows.find((item) => item.user_id === staff.id && item.work_date === workDate); const cell = row?.day_status ?? classifyAttendanceDay({ workDate, today, isBusinessDate: isAttendanceBusinessDate(workDate) }); return { date: workDate, ...cell }; }); return { staffId: staff.id, name: staff.full_name, departmentName: departmentFor(staff)?.name ?? "", cells, totalWorkday: cells.reduce((sum, cell) => sum + cell.workday, 0) }; }) } : undefined;
  return apiJson({
    scope: organizationScope ? "organization" : "personal",
    orgScope: access.orgScope,
    canManage: access.canManage,
    reviewableLateExceptionIds,
    demo: false,
    rows, monthlyRows, filterOptions, ...(grid ? { grid } : {}),
    message: `Đã tải ${(dayResult.data ?? []).length} bản ghi theo ${period === "day" ? "ngày" : period === "week" ? "tuần" : "tháng"}.`,
  });
}
