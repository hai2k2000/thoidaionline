import { logAudit } from "./audit";
import { db, fail, ok, ServiceResult, withError } from "./common";

export type PerformanceCycle = {
  id?: string;
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  status?: "draft" | "open" | "closed";
};

export type PerformanceReview = {
  id?: string;
  cycle_id: string;
  employee_id: string;
  reviewer_id?: string | null;
  self_score?: number | null;
  reviewer_score?: number | null;
  final_score?: number | null;
  rank?: string | null;
  self_comment?: string | null;
  reviewer_comment?: string | null;
  status?: "draft" | "submitted" | "reviewed" | "approved";
};

export async function listCycles(): Promise<ServiceResult<PerformanceCycle[]>> {
  try {
    const { data, error } = await db.from("performance_cycles").select("*").order("start_date", { ascending: false });
    if (error) return fail(error.message);
    return ok((data ?? []) as PerformanceCycle[]);
  } catch (error) {
    return fail(withError(error, "Không tải được kỳ đánh giá."));
  }
}

export async function createCycle(input: PerformanceCycle, actorId?: string): Promise<ServiceResult<PerformanceCycle>> {
  if (!input.code?.trim() || !input.name?.trim() || !input.start_date || !input.end_date) {
    return fail("Thiếu code, name, start_date hoặc end_date.");
  }

  try {
    const { data, error } = await db
      .from("performance_cycles")
      .insert({
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        start_date: input.start_date,
        end_date: input.end_date,
        status: input.status ?? "draft",
        created_by: actorId ?? null,
      })
      .select("*")
      .single();

    if (error) return fail(error.message);

    await logAudit({
      actorId,
      module: "performance",
      entityType: "performance_cycles",
      entityId: data.id,
      action: "create",
      newData: data,
    });

    return ok(data as PerformanceCycle);
  } catch (error) {
    return fail(withError(error, "Không tạo được kỳ đánh giá."));
  }
}

export async function upsertReview(input: PerformanceReview, actorId?: string): Promise<ServiceResult<PerformanceReview>> {
  if (!input.cycle_id || !input.employee_id) return fail("Thiếu cycle_id hoặc employee_id.");

  try {
    const { data, error } = await db
      .from("performance_reviews")
      .upsert({
        ...input,
        updated_at: new Date().toISOString(),
        status: input.status ?? "draft",
      })
      .select("*")
      .single();

    if (error) return fail(error.message);

    await logAudit({
      actorId,
      module: "performance",
      entityType: "performance_reviews",
      entityId: data.id,
      action: "update",
      newData: data,
    });

    return ok(data as PerformanceReview);
  } catch (error) {
    return fail(withError(error, "Không lưu được phiếu đánh giá."));
  }
}
