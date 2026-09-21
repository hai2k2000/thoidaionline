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
  "creator:staff_users!work_schedules_created_by_fkey(full_name,department_id)",
  "approver:staff_users!work_schedules_approver_id_fkey(full_name)",
  "reviewer:staff_users!work_schedules_reviewed_by_fkey(full_name)",
].join(",");

export const workScheduleRepository = {
  async allPeople() {
    const { data, error } = await serverSupabase.from("staff_users")
      .select("id,username,full_name,roles(code),job_titles(code)")
      .eq("active", true).order("full_name");
    return error ? { ok: false as const, error } : {
      ok: true as const,
      people: sortStaffRows(data ?? []).filter((person) => !isSystemAdminStaff(person)),
    };
  },

  async person(id: string) {
    const { data, error } = await serverSupabase.from("staff_users")
      .select("id,username,full_name,roles(code),job_titles(code)")
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
    return error ? { ok: false as const, error } : { ok: true as const, rows: data ?? [] };
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

  async saveOrganization(actorId: string, input: WorkScheduleInput) {
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

  async removeOrganization(id: string) {
    const { error } = await serverSupabase.from("work_schedules").delete().eq("id", id)
      .or("schedule_scope.eq.organization,schedule_scope.is.null");
    return error ? { ok: false as const, error } : { ok: true as const };
  },

  async people() {
    const { data, error } = await serverSupabase.from("staff_users")
      .select("id,username,full_name,roles(code),job_titles(code)")
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
