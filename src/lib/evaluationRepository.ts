import "server-only";

import type { AuthorizationActor } from "@/lib/authorization";
import { serverSupabase } from "@/lib/serverSupabase";

export type RubricFactor = { position: number; factor_code: string; label: string; description: string; max_score: number; band_definitions: unknown };
export type RubricVersion = { id: string; version_no: number; status: "draft" | "published" | "retired"; effective_from: string | null; published_at: string | null; evaluation_rubric_factors: RubricFactor[] };
export type EvaluationEvidence = { id: string; title: string; status: string; due_date: string | null };
export type EvaluationItem = {
  id: string; employeeId: string; employeeName: string; departmentId: string | null; departmentName: string;
  cycleId: string; cycleName: string; cycleStart: string; cycleEnd: string; status: string; workflowType: string;
  selfScore: number | null; managerScore: number | null; finalScore: number | null; rank: string | null;
  factors: RubricFactor[]; evidence: EvaluationEvidence[]; canSelf: boolean; canManager: boolean; canTbt: boolean;
};
export type EvaluationPageData = { items: EvaluationItem[]; openCycles: { id: string; name: string; start_date: string; end_date: string }[]; currentUserId: string };

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

  async rubrics() {
    const [rubrics, cycles] = await Promise.all([
      serverSupabase.from("evaluation_rubric_versions").select("id,version_no,status,effective_from,published_at,evaluation_rubric_factors(position,factor_code,label,description,max_score,band_definitions)").order("version_no", { ascending: false }),
      serverSupabase.from("performance_cycles").select("id,code,name,start_date,end_date,status").order("start_date", { ascending: false }),
    ]);
    return { rubrics: (rubrics.data ?? []) as unknown as RubricVersion[], cycles: cycles.data ?? [], failed: Boolean(rubrics.error || cycles.error) };
  },

  rpc(name: string, args: Record<string, unknown>) { return serverSupabase.rpc(name, args); },
};
