import "server-only";

import type { AuthorizationActor } from "@/lib/authorization";
import { serverSupabase } from "@/lib/serverSupabase";
import { resolvePersonnelEvaluationAction } from "@/lib/personnelEvaluationAccess";

export type RubricFactor = { position: number; factor_code: string; label: string; description: string; max_score: number; band_definitions: unknown };
export type RubricVersion = { id: string; version_no: number; status: "draft" | "published" | "retired"; effective_from: string | null; published_at: string | null; evaluation_rubric_factors: RubricFactor[] };
export type PerformanceCycleHistory = { id: string; code: string; name: string; cycle_type: "weekly" | "monthly"; start_date: string; end_date: string; status: string; rubric_versions: string; total_reviews: number; self_draft_count: number; awaiting_manager_count: number; awaiting_tbt_count: number; published_count: number; other_count: number };
export type EvaluationEvidence = { id: string; title: string; status: string; due_date: string | null };
export type EvaluationItem = {
  id: string; employeeId: string; employeeName: string; departmentId: string | null; departmentName: string;
  cycleId: string; cycleName: string; cycleStart: string; cycleEnd: string; status: string; workflowType: string;
  selfScore: number | null; managerScore: number | null; finalScore: number | null; rank: string | null;
  factors: RubricFactor[]; evidence: EvaluationEvidence[]; canSelf: boolean; canManager: boolean; canTbt: boolean;
};
export type EvaluationPageData = { items: EvaluationItem[]; openCycles: { id: string; name: string; start_date: string; end_date: string }[]; currentUserId: string };
export type PersonnelEvaluationSubject = {
  employeeId: string; employeeName: string; departmentId: string | null;
  departmentName: string; isDepartmentManager: boolean;
  reviewId: string | null; reviewStatus: string | null;
  workflowType: string | null; cycleId: string | null;
  cycleName: string | null; cycleStart: string | null; cycleEnd: string | null;
  selfScore: number | null; managerScore: number | null;
  finalScore: number | null; rank: string | null;
};
export type PersonnelEvaluationTask = {
  id: string; title: string; description: string | null; status: string;
  department_id: string | null; department_name: string | null;
  assignee_id: string | null; assignee_name: string | null;
  reviewer_id: string | null; reviewer_name: string | null;
  difficulty: string; completion_status: string;
  deadline_outcome: string; due_date: string | null;
  evaluation_criteria: string | null; task_type: string | null;
  assignment_mode: string | null; plan_period: string | null;
  progress_percent: number; start_date: string | null; created_at: string;
  completion_submitted_at: string | null; completed_at: string | null;
  cancelled_at: string | null; cancel_reason: string | null;
  owner_id: string | null; owner_name: string | null;
  attachments: { id: string; file_name: string; mime_type: string; size_bytes: number; created_at: string; uploaded_by: string | null }[];
  progress_reports: { id: string; reported_by: string; reported_on: string; report_status: string; progress_text: string; blockers: string | null; created_at: string }[];
  progress_logs: { id: string; old_progress: number | null; new_progress: number; note: string | null; created_at: string; user_id: string | null }[];
  comments: { id: string; content: string; created_at: string; user_id: string | null; author_name: string | null }[];
  qualitative_evaluations: { id: string; evaluation_text: string; evaluation_deadline: string; evaluation_source: string; created_at: string; evaluator_name: string | null }[];
  legacy_evaluations: { id: string; employee_id: string; opinion: string | null; checkpoint_date: string; created_at: string }[];
  deadline_history: { id: string; old_due_date: string | null; new_due_date: string | null; reason: string; changed_at: string }[];
  status_events: { id: string; from_status: string | null; to_status: string; reason: string | null; created_at: string }[];
};
export type PersonnelEvaluationScore = {
  stage: "self" | "manager" | "tbt"; factor_code: string;
  score: number; comment: string | null;
};
export type PersonnelEvaluationDetail = {
  employeeId: string; employeeName: string; departmentName: string;
  reviewId: string | null; reviewStatus: string | null; workflowType: string | null;
  cycleName: string | null; cycleStart: string | null; cycleEnd: string | null;
  allowedAction: "manager" | "tbt" | null;
  factors: RubricFactor[]; scores: PersonnelEvaluationScore[];
  tasks: PersonnelEvaluationTask[];
};
export type PersonnelEvaluationData = {
  subjects: PersonnelEvaluationSubject[]; detail: PersonnelEvaluationDetail | null;
  from: string; to: string; selectedEmployeeId: string | null;
};

type RawReview = {
  id: string; employee_id: string; status: string; workflow_type: string | null; self_score: number | null; reviewer_score: number | null; final_score: number | null; rank: string | null;
  rubric_snapshot: { factors?: RubricFactor[] } | null;
  performance_cycles: { id: string; name: string; start_date: string; end_date: string } | null;
  staff_users: { full_name: string; department_id: string | null; departments: { name: string; manager_id: string | null } | null } | null;
};

const canSee = (actor: AuthorizationActor, review: RawReview) => {
  if (actor.roleCode === "tong_bien_tap" && actor.permissions.can_evaluate_step2) return true;
  if (review.employee_id === actor.id) return true;
  return actor.permissions.can_evaluate_step1 && review.staff_users?.departments?.manager_id === actor.id;
};

export const evaluationRepository = {
  async list(actor: AuthorizationActor, filters: Record<string, string | string[] | undefined> = {}): Promise<EvaluationPageData> {
    await serverSupabase.rpc("api_ensure_current_performance_cycle", { p_actor: actor.id });
    const [reviewsResult, cyclesResult] = await Promise.all([
      serverSupabase.from("performance_reviews").select("id,employee_id,status,workflow_type,self_score,reviewer_score,final_score,rank,rubric_snapshot,performance_cycles!inner(id,name,start_date,end_date),staff_users!performance_reviews_employee_id_fkey!inner(full_name,department_id,departments(name,manager_id))").order("created_at", { ascending: false }),
      serverSupabase.from("performance_cycles").select("id,name,start_date,end_date").eq("status", "open").order("start_date", { ascending: false }),
    ]);
    const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
    const from = one(filters.from); const to = one(filters.to); const department = one(filters.department)?.trim().toLocaleLowerCase("vi");
    const employee = one(filters.employee)?.trim().toLocaleLowerCase("vi"); const status = one(filters.status);
    const visible = ((reviewsResult.data ?? []) as unknown as RawReview[]).filter((row) => {
      if (!canSee(actor, row)) return false;
      const cycle = row.performance_cycles;
      if (from && cycle && cycle.end_date < from) return false;
      if (to && cycle && cycle.start_date > to) return false;
      if (status && row.status !== status) return false;
      if (department && row.staff_users?.department_id !== department && !row.staff_users?.departments?.name.toLocaleLowerCase("vi").includes(department)) return false;
      return !employee || Boolean(row.staff_users?.full_name.toLocaleLowerCase("vi").includes(employee));
    });
    const items = await Promise.all(visible.map(async (row): Promise<EvaluationItem> => {
      const cycle = row.performance_cycles!;
      const evidenceResult = await serverSupabase.from("task_assignees").select("tasks!inner(id,title,status,due_date,start_date)").eq("user_id", row.employee_id);
      const evidence = ((evidenceResult.data ?? []) as unknown as { tasks: EvaluationEvidence & { start_date: string | null } }[])
        .map((entry) => entry.tasks).filter((task) => (!task.start_date || task.start_date <= cycle.end_date) && (!task.due_date || task.due_date >= cycle.start_date));
      const ownUnpublished = row.employee_id === actor.id && row.status !== "published";
      return {
        id: row.id, employeeId: row.employee_id, employeeName: row.staff_users?.full_name ?? "—", departmentId: row.staff_users?.department_id ?? null,
        departmentName: row.staff_users?.departments?.name ?? "—", cycleId: cycle.id, cycleName: cycle.name, cycleStart: cycle.start_date, cycleEnd: cycle.end_date,
        status: row.status, workflowType: row.workflow_type ?? "employee", selfScore: row.self_score,
        managerScore: ownUnpublished ? null : row.reviewer_score, finalScore: row.status === "published" ? row.final_score : null,
        rank: row.status === "published" ? row.rank : null, factors: row.rubric_snapshot?.factors ?? [], evidence,
        canSelf: row.employee_id === actor.id && row.status === "self_draft",
        canManager: actor.permissions.can_evaluate_step1 && row.staff_users?.departments?.manager_id === actor.id && row.employee_id !== actor.id && row.status === "awaiting_manager",
        canTbt: actor.roleCode === "tong_bien_tap" && actor.permissions.can_evaluate_step2 && row.status === "awaiting_tbt",
      };
    }));
    return { items, openCycles: (cyclesResult.data ?? []) as EvaluationPageData["openCycles"], currentUserId: actor.id };
  },

  async personnelDetail(actor: AuthorizationActor, filters: {
    from: string; to: string; employeeId: string;
  }): Promise<{ ok: true; data: PersonnelEvaluationDetail } | { ok: false; errorCode: string | null }> {
    await serverSupabase.rpc("api_ensure_current_performance_cycle", { p_actor: actor.id });
    const result = await serverSupabase.rpc("api_get_personnel_evaluation_detail", {
      p_actor: actor.id, p_employee: filters.employeeId,
      p_from: filters.from, p_to: filters.to,
    });
    if (result.error) return { ok: false, errorCode: result.error.code ?? null };
    const row = result.data as {
      employee_id: string; employee_name: string; department_name: string;
      review_id: string | null; review_status: string | null; workflow_type: string | null;
      cycle_name: string | null; cycle_start: string | null; cycle_end: string | null;
      allowed_action: "manager" | "tbt" | null; factors: RubricFactor[];
      scores: PersonnelEvaluationScore[]; tasks: PersonnelEvaluationTask[];
    };
    return { ok: true, data: {
      employeeId: row.employee_id, employeeName: row.employee_name,
      departmentName: row.department_name, reviewId: row.review_id,
      reviewStatus: row.review_status, workflowType: row.workflow_type,
      cycleName: row.cycle_name, cycleStart: row.cycle_start, cycleEnd: row.cycle_end,
      allowedAction: resolvePersonnelEvaluationAction({
        directTbtEnabled: process.env.TBT_DIRECT_EVALUATION_ENABLED === "true",
        roleCode: actor.roleCode,
        canEvaluateStep2: actor.permissions.can_evaluate_step2,
        reviewStatus: row.review_status,
        hasTbtScore: (row.scores ?? []).some((score) => score.stage === "tbt"),
        rpcAction: row.allowed_action,
      }), factors: row.factors ?? [],
      scores: row.scores ?? [], tasks: row.tasks ?? [],
    } };
  },

  async personnelList(actor: AuthorizationActor, filters: {
    from: string; to: string; employeeId: string | null;
  }): Promise<
    | { ok: true; data: PersonnelEvaluationData }
    | { ok: false; errorCode: string | null }
  > {
    await serverSupabase.rpc("api_ensure_current_performance_cycle", { p_actor: actor.id });
    const [subjectsResult, directTbtTitlesResult] = await Promise.all([
      serverSupabase.rpc(
        "api_list_personnel_evaluation_subjects",
        { p_actor: actor.id, p_from: filters.from, p_to: filters.to },
      ),
      serverSupabase.from("staff_users")
        .select("id,job_titles!inner(code)")
        .eq("active", true)
        .eq("job_titles.code", "pho_tong_bien_tap"),
    ]);
    if (subjectsResult.error) {
      return { ok: false, errorCode: subjectsResult.error.code ?? null };
    }
    type RawSubject = {
      employee_id: string; employee_name: string;
      department_id: string | null; department_name: string;
      is_department_manager: boolean; review_id: string | null;
      review_status: string | null; workflow_type: string | null;
      cycle_id: string | null; cycle_name: string | null;
      cycle_start: string | null; cycle_end: string | null;
      self_score: number | null; manager_score: number | null;
      final_score: number | null; rank: string | null;
    };
    const directTbtEmployeeIds = new Set(
      (directTbtTitlesResult.data ?? []).map((row) => row.id as string),
    );
    const subjects = ((subjectsResult.data ?? []) as RawSubject[]).map(
      (row): PersonnelEvaluationSubject => ({
        employeeId: row.employee_id, employeeName: row.employee_name,
        departmentId: row.department_id, departmentName: row.department_name,
        isDepartmentManager: row.is_department_manager
          || (actor.roleCode === "tong_bien_tap"
            && directTbtEmployeeIds.has(row.employee_id)),
        reviewId: row.review_id, reviewStatus: row.review_status,
        workflowType: row.workflow_type, cycleId: row.cycle_id,
        cycleName: row.cycle_name, cycleStart: row.cycle_start,
        cycleEnd: row.cycle_end, selfScore: row.self_score,
        managerScore: row.manager_score, finalScore: row.final_score,
        rank: row.rank,
      }),
    );
    let detail: PersonnelEvaluationDetail | null = null;
    if (filters.employeeId) {
      const detailResult = await serverSupabase.rpc(
        "api_get_personnel_evaluation_detail",
        {
          p_actor: actor.id, p_employee: filters.employeeId,
          p_from: filters.from, p_to: filters.to,
        },
      );
      if (detailResult.error) {
        return { ok: false, errorCode: detailResult.error.code ?? null };
      }
      const row = detailResult.data as {
        employee_id: string; employee_name: string; department_name: string;
        review_id: string | null; review_status: string | null;
        workflow_type: string | null; cycle_name: string | null;
        cycle_start: string | null; cycle_end: string | null;
        allowed_action: "manager" | "tbt" | null;
        factors: RubricFactor[]; scores: PersonnelEvaluationScore[];
        tasks: PersonnelEvaluationTask[];
      };
      detail = {
        employeeId: row.employee_id, employeeName: row.employee_name,
        departmentName: row.department_name, reviewId: row.review_id,
        reviewStatus: row.review_status, workflowType: row.workflow_type,
        cycleName: row.cycle_name, cycleStart: row.cycle_start,
        cycleEnd: row.cycle_end, allowedAction: resolvePersonnelEvaluationAction({
          directTbtEnabled: process.env.TBT_DIRECT_EVALUATION_ENABLED === "true",
          roleCode: actor.roleCode,
          canEvaluateStep2: actor.permissions.can_evaluate_step2,
          reviewStatus: row.review_status,
          hasTbtScore: (row.scores ?? []).some((score) => score.stage === "tbt"),
          rpcAction: row.allowed_action,
        }),
        factors: row.factors ?? [], scores: row.scores ?? [],
        tasks: row.tasks ?? [],
      };
    }
    return {
      ok: true,
      data: { subjects, detail, from: filters.from, to: filters.to,
        selectedEmployeeId: filters.employeeId },
    };
  },

  async rubrics(actorId: string) {
    await serverSupabase.rpc("api_ensure_current_performance_cycle", { p_actor: actorId });
    const [rubrics, cycles] = await Promise.all([
      serverSupabase.from("evaluation_rubric_versions").select("id,version_no,status,effective_from,published_at,evaluation_rubric_factors(position,factor_code,label,description,max_score,band_definitions)").order("version_no", { ascending: false }),
      serverSupabase.rpc("api_list_performance_cycle_history", { p_actor: actorId }),
    ]);
    return { rubrics: (rubrics.data ?? []) as unknown as RubricVersion[], cycles: (cycles.data ?? []) as PerformanceCycleHistory[], failed: Boolean(rubrics.error || cycles.error) };
  },

  rpc(name: string, args: Record<string, unknown>) { return serverSupabase.rpc(name, args); },
};
