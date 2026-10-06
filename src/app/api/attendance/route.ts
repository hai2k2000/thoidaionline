import { apiError, apiJson, asUuid, readJsonObject, requireMutationActor, requireReadActor } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";
import { isForeignReporter } from "@/lib/onlineWorkLanguage.mjs";
import { calculateAttendance } from "@/lib/attendanceWorkday";
import { clampAttendanceEndDate, filterBusinessAttendanceRows, isAttendanceBusinessDate, recentAttendanceRange } from "@/lib/attendanceRecentRange.mjs";
import { isAttendanceListedStaff, roleCodeFromRelation } from "@/lib/attendanceVisibility.mjs";

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
  admin_note?: string | null;
  admin_note_at?: string | null;
  has_attendance_log?: boolean;
  workday?: number;
  staff_users?: { full_name: string; roles?: { code?: string | null } | { code?: string | null }[] | null } | null;
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


export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  if (!guard.actor.rbacPermissions.includes("task.quick_report.create")) return apiError("forbidden", 403);
  const body = await readJsonObject(request);
  const workDate = typeof body?.workDate === "string" ? body.workDate : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!isValidDate(workDate) || note.length < 3 || note.length > 2000) return apiError("invalid_request", 400);

  const existing = await serverSupabase
    .from("attendance_logs")
    .select("id,check_in,check_out,note,status,late_exception")
    .eq("user_id", guard.actor.id)
    .eq("work_date", workDate)
    .maybeSingle();
  if (existing.error) return apiError("operation_failed", 500);
  const row = existing.data as { id: string; check_in: string | null; check_out: string | null; note: string | null; status: string | null; late_exception: string | null } | null;
  const protectedStatus = row?.status === "leave" || row?.status === "absent";
  if (!row || protectedStatus || row.status !== "late" || !calculateAttendance({ checkIn: row.check_in, checkOut: row.check_out }).late) return apiError("invalid_request", 400);
  if (row.late_exception === "sudden_work") return apiError("conflict", 409);
  const mergedNote = [row.note?.trim(), note].filter(Boolean).join("; ");
  const updated = await serverSupabase
    .from("attendance_logs")
    .update({ late_exception: "sudden_work", note: mergedNote })
    .eq("id", row.id)
    .eq("user_id", guard.actor.id)
    .select("id,work_date,check_in,check_out,note,status,late_exception")
    .maybeSingle();
  if (updated.error || !updated.data) return apiError("operation_failed", 500);
  return apiJson({ ok: true, row: updated.data });
}

export async function PATCH(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  if (guard.actor.role_code !== "admin") return apiError("forbidden", 403);
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

export async function GET(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;

  const params = new URL(request.url).searchParams;
  const date = params.get("date") ?? "";
  const period = params.get("period") ?? "day";
  const scope = params.get("scope") ?? "personal";
  const recent = params.get("recent") === "1";
  const offset = Math.max(0, Number.parseInt(params.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(31, Math.max(1, Number.parseInt(params.get("limit") ?? "10", 10) || 10));
  if (!isValidDate(date) || !["personal", "organization"].includes(scope) || !["day", "week", "month"].includes(period)) {
    return apiError("invalid_request", 400);
  }
  if (scope === "organization" && guard.actor.role_code !== "admin") {
    return apiError("forbidden", 403);
  }

  // Organization-wide attendance is deliberately an admin-only scope. The
  // personal scope remains tied to the signed-in actor even for administrators.
  const organizationScope = scope === "organization";
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
    .select("id,user_id,work_date,check_in,check_out,note,status,late_exception,staff_users(full_name,roles(code))")
    .gte("work_date", rangeStart)
    .lte("work_date", rangeEnd)
    .order("check_in", { ascending: true, nullsFirst: false })
    .limit(500);
  let monthQuery = serverSupabase
    .from("attendance_logs")
    .select("id,user_id,work_date,check_in,check_out,note,status,late_exception,staff_users(full_name,roles(code))")
    .gte("work_date", period === "day" ? monthStart : summaryRangeStart)
    .lte("work_date", period === "day" ? anchorDate : summaryRangeEnd)
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
  const contextStart = period === "day" ? monthStart : summaryRangeStart;
  const contextEnd = period === "day" ? anchorDate : summaryRangeEnd;
  const adminNoteFields = "id,user_id,work_date,note,created_at,updated_at,staff_users(full_name)";
  let dayAdminNotesQuery = serverSupabase.from("attendance_admin_notes").select(adminNoteFields).gte("work_date", rangeStart).lte("work_date", rangeEnd).limit(500);
  let monthAdminNotesQuery = serverSupabase.from("attendance_admin_notes").select(adminNoteFields).gte("work_date", contextStart).lte("work_date", contextEnd).limit(10000);
  if (!organizationScope) {
    dayAdminNotesQuery = dayAdminNotesQuery.eq("user_id", guard.actor.id);
    monthAdminNotesQuery = monthAdminNotesQuery.eq("user_id", guard.actor.id);
  }
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
  const [dayAdminNotesResult, monthAdminNotesResult, leaveResult, onlineResult] = await Promise.all([dayAdminNotesQuery, monthAdminNotesQuery, leaveQuery, onlineQuery]);
  if (dayAdminNotesResult.error || monthAdminNotesResult.error || leaveResult.error || onlineResult.error) return apiError("operation_failed", 500);
  const dayAdminNotes = (dayAdminNotesResult.data ?? []) as unknown as Array<{ id: string; user_id: string; work_date: string; note: string; created_at: string; updated_at: string; staff_users: { full_name: string } | null }>;
  const monthAdminNotes = (monthAdminNotesResult.data ?? []) as unknown as typeof dayAdminNotes;
  const leaves = (leaveResult.data ?? []) as unknown as Array<{ start_date: string; end_date: string; start_period: string; end_period: string; leave_type: string; requester: { id: string; full_name: string } | null }>;
  const online = (onlineResult.data ?? []) as unknown as Array<{ work_date: string; staff: { id: string; full_name: string } | null }>;
  const staffResult = organizationScope
    ? await serverSupabase.from("staff_users").select("id,full_name,username,roles(code)").eq("active", true).order("full_name")
    : { data: [{ id: guard.actor.id, full_name: guard.actor.full_name, username: guard.actor.username }], error: null };
  if (staffResult.error) return apiError("operation_failed", 500);
  const staffRows = organizationScope
    ? (staffResult.data ?? []).filter((staff) => isAttendanceListedStaff({ full_name: staff.full_name, role_code: "roles" in staff ? roleCodeFromRelation(staff.roles) : null }))
    : (staffResult.data ?? []);
  const foreignStaff = staffRows.filter((staff) => isForeignReporter(staff.username));
  const foreignById = new Map(foreignStaff.filter((staff) => isForeignReporter(staff.username)).map((staff) => [staff.id, staff]));
  // A blank weekend schedule means the whole foreign-language team works online by default.
  for (const staff of foreignById.values()) {
    for (const cursor = new Date(`${contextStart}T12:00:00Z`); cursor <= new Date(`${contextEnd}T12:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const workDate = cursor.toISOString().slice(0, 10);
      if (isAttendanceBusinessDate(workDate) && !online.some((row) => row.work_date === workDate && row.staff?.id === staff.id)) {
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
    const extraNotes: string[] = [];
    if (leave) extraNotes.push(leaveLabel(leave, row.work_date));
    const leaveIsFull = !!leave && leavePeriodsForDate(leave, row.work_date).every((period) => period === "full");
    const leaveWorkday = leave ? (leaveIsFull ? 1 : 0.5) : 0;
    if (onlineDay && !leaveIsFull) extraNotes.push("Làm việc online");
    return calculateAttendance({
      checkIn: row.check_in,
      checkOut: row.check_out,
      existingNote: row.note,
      extraNotes,
      exceptional: row.status === "leave" || row.status === "absent" || !!leaveWorkday || (onlineDay && !row.check_in && !row.check_out),
      lateException: row.late_exception === "sudden_work",
      exceptionalWorkday: leaveWorkday || (onlineDay && !leaveIsFull ? 1 : 0),
    });
  };
  const withNotes = (items: AttendanceRow[], adminNotes: typeof dayAdminNotes) => {
    const adminByKey = new Map(adminNotes.map((item) => [`${item.user_id}:${item.work_date}`, item]));
    return items.map((row) => {
      const admin = adminByKey.get(`${row.user_id}:${row.work_date}`);
      return {
        ...row,
        admin_note: admin?.note ?? null,
        admin_note_at: admin?.updated_at ?? admin?.created_at ?? null,
        has_attendance_log: true,
      };
    }).map((row) => {
    const calculation = noteFor(row);
    return { ...row, workday: calculation.workday, note: calculation.note };
    });
  };
  const contextRows = (items: AttendanceRow[], from: string, to: string, adminNotes: typeof dayAdminNotes) => {
    const result: AttendanceRow[] = filterBusinessAttendanceRows(withNotes(items, adminNotes)).filter((row: AttendanceRow) => !organizationScope || isAttendanceListedStaff({ full_name: row.staff_users?.full_name, role_code: roleCodeFromRelation(row.staff_users?.roles) }));
    const existing = new Set(result.map((row) => `${row.user_id}:${row.work_date}`));
    const dates = (start: string, end: string) => {
      const out: string[] = [];
      for (let cursor = new Date(`${start}T12:00:00Z`); cursor <= new Date(`${end}T12:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) out.push(cursor.toISOString().slice(0, 10));
      return out;
    };
    for (const admin of adminNotes) {
      if (!admin.staff_users || admin.work_date < from || admin.work_date > to || !isAttendanceBusinessDate(admin.work_date) || (organizationScope && !isAttendanceListedStaff({ full_name: admin.staff_users.full_name, role_code: "employee" }))) continue;
      const key = `${admin.user_id}:${admin.work_date}`;
      if (existing.has(key)) continue;
      result.push({ id: `admin-note-${admin.user_id}-${admin.work_date}`, user_id: admin.user_id, work_date: admin.work_date, check_in: null, check_out: null, note: "", admin_note: admin.note, admin_note_at: admin.updated_at ?? admin.created_at, has_attendance_log: false, status: "absent", staff_users: { full_name: admin.staff_users.full_name }, workday: 0 });
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
        result.push({ id: `leave-${leave.requester.id}-${workDate}`, user_id: leave.requester.id, work_date: workDate, check_in: null, check_out: null, note: label, status: "leave", staff_users: { full_name: leave.requester.full_name }, workday });
        existing.add(key);
      }
    }
    for (const onlineRow of online) {
      if (!onlineRow.staff) continue;
      if (onlineRow.work_date < from || onlineRow.work_date > to || !isAttendanceBusinessDate(onlineRow.work_date)) continue;
      const key = `${onlineRow.staff.id}:${onlineRow.work_date}`;
      if (existing.has(key)) continue;
      result.push({ id: `online-${onlineRow.staff.id}-${onlineRow.work_date}`, user_id: onlineRow.staff.id, work_date: onlineRow.work_date, check_in: null, check_out: null, note: "Làm việc online", status: "present", staff_users: { full_name: onlineRow.staff.full_name }, workday: 1 });
      existing.add(key);
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
    return result.sort((a, b) => {
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
  return apiJson({
    scope: organizationScope ? "organization" : "personal",
    demo: false,
    rows: contextRows((dayResult.data ?? []) as unknown as AttendanceRow[], rangeStart, rangeEnd, dayAdminNotes),
    monthlyRows: contextRows((monthResult.data ?? []) as unknown as AttendanceRow[], period === "day" ? monthStart : summaryRangeStart, period === "day" ? anchorDate : summaryRangeEnd, monthAdminNotes),
    message: `Đã tải ${(dayResult.data ?? []).length} bản ghi theo ${period === "day" ? "ngày" : period === "week" ? "tuần" : "tháng"}.`,
  });
}
