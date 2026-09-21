import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";
import { isSystemAdminStaff, sortStaffRows } from "@/lib/staffOrdering";

export type WorkScheduleInput = {
  id?: string;
  workDate: string;
  endDate: string;
  planType: "work" | "business" | "event";
  startTime: string | null;
  endTime: string | null;
  title: string;
  location: string | null;
  notes: string | null;
  participantIds: string[];
};

const fields = [
  "id,work_date,end_date,plan_type,start_time,end_time,title,location,notes",
  "participant_ids,created_by,schedule_scope,approval_status,approver_id",
  "reviewed_by,reviewed_at,review_note,submitted_at,workflow_revision",
  "event_assignment_kind,event_type,creator_department_id,event_status",
  "creator:staff_users!work_schedules_created_by_fkey!inner(full_name,department_id)",
  "approver:staff_users!work_schedules_approver_id_fkey(full_name)",
  "reviewer:staff_users!work_schedules_reviewed_by_fkey(full_name)",
].join(",");

const eventFields = [
  "id,work_date,end_date,plan_type,start_time,end_time,title,location,notes",
  "participant_ids,created_by,schedule_scope,approval_status,workflow_revision",
  "event_assignment_kind,event_type,creator_department_id,event_status",
  "creator:staff_users!work_schedules_created_by_fkey!inner(full_name,department_id)",
  "event_assignments:work_schedule_event_assignments!work_schedule_event_assignments_event_id_fkey(staff_id,assigned_by,assigned_at,note,assignee:staff_users!work_schedule_event_assignments_staff_id_fkey(full_name),assigner:staff_users!work_schedule_event_assignments_assigned_by_fkey(full_name))",
].join(",");

export const workScheduleRepository = {
  async allPeople() {
    const { data, error } = await serverSupabase.from("staff_users")
      .select("id,username,full_name,department_id,roles(code),job_titles(code)")
      .eq("active", true).order("full_name");
    return error ? { ok: false as const, error } : {
      ok: true as const,
      people: sortStaffRows(data ?? []).filter((person) => !isSystemAdminStaff(person)),
    };
  },

  async person(id: string) {
    const { data, error } = await serverSupabase.from("staff_users")
      .select("id,username,full_name,department_id,roles(code),job_titles(code)")
      .eq("id", id).eq("active", true).maybeSingle();
    return error ? { ok: false as const, error } : { ok: true as const, person: data };
  },

  async listOrganization(from: string, to: string, participantId?: string) {
    let query = serverSupabase.from("work_schedules").select(fields)
      .or("schedule_scope.eq.organization,schedule_scope.is.null")
      .lte("work_date", to).gte("end_date", from);
    if (participantId) query = query.contains("participant_ids", [participantId]);
    const { data, error } = await query.order("work_date").order("start_time");
    return error ? { ok: false as const, error } : { ok: true as const, rows: data ?? [] };
  },

  async listPersonal(from: string, to: string, actorId: string) {
    const { data, error } = await serverSupabase.from("work_schedules").select(fields)
      .or("schedule_scope.eq.personal,schedule_scope.is.null")
      .contains("participant_ids", [actorId])
      .lte("work_date", to).gte("end_date", from)
      .order("work_date").order("start_time");
    if (error) return { ok: false as const, error };
    const events = await serverSupabase.from("work_schedules").select(eventFields)
      .eq("event_assignment_kind", "leadership")
      .eq("schedule_scope", "organization")
      .contains("participant_ids", [actorId])
      .lte("work_date", to).gte("end_date", from)
      .order("work_date").order("start_time");
    if (events.error) return { ok: false as const, error: events.error };
    const rows = [
      ...((data ?? []) as unknown as Array<Record<string, unknown>>),
      ...((events.data ?? []) as unknown as Array<Record<string, unknown>>),
    ];
    return {
      ok: true as const,
      rows: rows.sort((a, b) =>
        (String(a.work_date) + "T" + String(a.start_time ?? ""))
          .localeCompare(String(b.work_date) + "T" + String(b.start_time ?? "")),
      ),
    };
  },

  async listPendingPersonal(departmentId?: string | null) {
    let query = serverSupabase.from("work_schedules").select(fields)
      .eq("schedule_scope", "personal")
      .eq("approval_status", "PENDING_APPROVAL")
      .order("submitted_at", { ascending: true });
    if (departmentId) query = query.eq("creator.department_id", departmentId);
    const { data, error } = await query;
    return error ? { ok: false as const, error } : { ok: true as const, rows: data ?? [] };
  },

  async listEventAssignments(from: string, to: string, actorId: string, scope: "global" | "department" | "self", departmentId?: string | null) {
    let query = serverSupabase.from("work_schedules").select(eventFields)
      .eq("event_assignment_kind", "leadership")
      .eq("schedule_scope", "organization")
      .lte("work_date", to).gte("end_date", from);
    if (scope === "self") query = query.contains("participant_ids", [actorId]);
    if (scope === "department") query = query.eq("creator_department_id", departmentId ?? "");
    const { data, error } = await query.order("work_date").order("start_time");
    return error ? { ok: false as const, error } : { ok: true as const, rows: data ?? [] };
  },

  async saveEventAssignment(actorId: string, input: {
    id?: string;
    workflowRevision?: number;
    workDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    eventType: string;
    title: string;
    location: string | null;
    notes: string | null;
    reporterIds: string[];
  }) {
    const rpc = input.id ? "api_update_event_assignment" : "api_create_event_assignment";
    const args = input.id ? {
      p_actor: actorId, p_id: input.id, p_expected_revision: input.workflowRevision,
      p_work_date: input.workDate, p_end_date: input.endDate, p_start_time: input.startTime,
      p_end_time: input.endTime, p_event_type: input.eventType, p_title: input.title,
      p_location: input.location, p_notes: input.notes, p_reporter_ids: input.reporterIds,
    } : {
      p_actor: actorId, p_work_date: input.workDate, p_end_date: input.endDate,
      p_start_time: input.startTime, p_end_time: input.endTime, p_event_type: input.eventType,
      p_title: input.title, p_location: input.location, p_notes: input.notes,
      p_reporter_ids: input.reporterIds,
    };
    const { data, error } = await serverSupabase.rpc(rpc, args);
    return error ? { ok: false as const, error } : { ok: true as const, row: data };
  },

  async setEventAssignmentStatus(actorId: string, id: string, workflowRevision: number, action: "cancel" | "complete") {
    const { data, error } = await serverSupabase.rpc("api_set_event_assignment_status", {
      p_actor: actorId, p_id: id, p_expected_revision: workflowRevision, p_action: action,
    });
    return error ? { ok: false as const, error } : { ok: true as const, row: data };
  },

  async savePersonal(actorId: string, input: WorkScheduleInput, expectedRevision: number | null) {
    const { data, error } = await serverSupabase.rpc("api_create_personal_work_schedule", {
      p_actor: actorId,
      p_id: input.id ?? null,
      p_work_date: input.workDate,
      p_end_date: input.endDate,
      p_plan_type: input.planType,
      p_start_time: input.startTime,
      p_end_time: input.endTime,
      p_title: input.title,
      p_location: input.location,
      p_notes: input.notes,
      p_participant_ids: input.participantIds,
      p_expected_revision: expectedRevision,
    });
    return error ? { ok: false as const, error } : { ok: true as const, row: data };
  },

  async reviewPersonal(actorId: string, id: string, action: "approve" | "reject", note: string, expectedRevision: number) {
    const { data, error } = await serverSupabase.rpc("api_review_personal_work_schedule", {
      p_actor: actorId,
      p_id: id,
      p_action: action,
      p_note: note,
      p_expected_revision: expectedRevision,
    });
    return error ? { ok: false as const, error } : { ok: true as const, row: data };
  },

  async saveOrganization(actorId: string, input: WorkScheduleInput, isAdmin = false) {
    const payload = {
      work_date: input.workDate,
      end_date: input.endDate,
      plan_type: input.planType,
      start_time: input.startTime,
      end_time: input.endTime,
      title: input.title,
      location: input.location,
      notes: input.notes,
      participant_ids: input.participantIds,
      schedule_scope: "organization",
      approval_status: "APPROVED",
      updated_at: new Date().toISOString(),
      ...(input.id ? {} : { created_by: actorId }),
    };
    let query = input.id
      ? serverSupabase.from("work_schedules").update(payload).eq("id", input.id)
        .or("schedule_scope.eq.organization,schedule_scope.is.null")
      : serverSupabase.from("work_schedules").insert({ ...payload, created_by: actorId });
    if (input.id && !isAdmin) query = query.eq("created_by", actorId);
    const { data, error } = await query.select().single();
    return error ? { ok: false as const, error } : { ok: true as const, row: data };
  },

  async removePersonal(actorId: string, id: string, isAdmin = false) {
    let query = serverSupabase.from("work_schedules").delete().eq("id", id)
      .or("schedule_scope.eq.personal,schedule_scope.is.null");
    if (!isAdmin) query = query.eq("created_by", actorId);
    const { error } = await query;
    return error ? { ok: false as const, error } : { ok: true as const };
  },

  async removeOrganization(actorId: string, id: string, isAdmin = false) {
    let query = serverSupabase.from("work_schedules").delete().eq("id", id)
      .or("schedule_scope.eq.organization,schedule_scope.is.null");
    if (!isAdmin) query = query.eq("created_by", actorId);
    const { error } = await query;
    return error ? { ok: false as const, error } : { ok: true as const };
  },

  async people() {
    const { data, error } = await serverSupabase.from("staff_users")
      .select("id,username,full_name,department_id,roles(code),job_titles(code)")
      .eq("active", true).order("full_name");
    return error ? { ok: false as const, error } : {
      ok: true as const,
      people: sortStaffRows(data ?? []).filter((person) => {
        const role = (person.roles as { code?: string } | null)?.code ?? "";
        const job = (person.job_titles as { code?: string } | null)?.code ?? "";
        return !isSystemAdminStaff(person) && (
          ["tong_bien_tap", "pho_tong_bien_tap"].includes(role)
          || job.startsWith("truong_phong")
          || job.startsWith("phong_vien")
        );
      }),
    };
  },
};
