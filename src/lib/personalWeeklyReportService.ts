import "server-only";

import {
  apiError,
  requireMutationActor,
  requireReadActor,
  rpcFailure,
} from "@/lib/serverApi";
import {
  completePersonalWeeklyReport as completeRepository,
  reopenPersonalWeeklyReport as reopenRepository,
  getPersonalWeeklyReport,
  savePersonalWeeklyDraft as saveRepository,
  type PersonalWeeklyMutationInput,
  type PersonalWeeklyReportLoad,
  type PersonalWeeklyReportRow,
} from "@/lib/personalWeeklyReportRepository";
import {
  personalWeeklyPeriod,
  validatePersonalWeeklyDraft,
  type PersonalWeeklyCurrentRow,
  type PersonalWeeklyNextRow,
} from "@/lib/personalWeeklyReport";

export type PersonalWeeklyResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code?: string | null; message?: string | null } };

type Input = {
  period?: { start: string; end: string };
  periodStart?: string;
  draftPayload?: Record<string, unknown>;
  currentRows?: PersonalWeeklyCurrentRow[];
  nextRows?: PersonalWeeklyNextRow[];
  difficulties?: string;
  reportId?: string;
  reason?: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function reportError(error: unknown): { code?: string; message?: string } {
  if (error && typeof error === "object") {
    const source = error as { code?: string; message?: string };
    return { code: source.code, message: source.message };
  }
  return { message: "weekly report operation failed" };
}

function periodFromInput(input: Input): { current: { start: string; end: string }; next: { start: string; end: string } } {
  const anchor = input.period?.start ?? input.periodStart ?? null;
  if (anchor !== null && !DATE.test(anchor)) throw Object.assign(new Error("invalid report period"), { code: "22023" });
  const period = personalWeeklyPeriod(anchor);
  if (input.period && (input.period.start !== period.current.start || input.period.end !== period.current.end)) {
    throw Object.assign(new Error("invalid report period"), { code: "22023" });
  }
  return period;
}

function payloadFromInput(input: Input): Record<string, unknown> {
  if (input.draftPayload && typeof input.draftPayload === "object" && !Array.isArray(input.draftPayload)) return input.draftPayload;
  return { currentRows: input.currentRows ?? [], nextRows: input.nextRows ?? [] };
}

function mutationInput(input: Input): PersonalWeeklyMutationInput {
  const period = periodFromInput(input);
  const draftPayload = payloadFromInput(input);
  const validation = validatePersonalWeeklyDraft(draftPayload);
  if (!validation.ok) throw Object.assign(new Error(validation.message), { code: "22023" });
  return {
    period: period.current,
    draftPayload: validation.value as unknown as Record<string, unknown>,
    difficulties: typeof input.difficulties === "string"
      ? input.difficulties.trim().slice(0, 10000)
      : typeof draftPayload.difficulties === "string" ? draftPayload.difficulties.slice(0, 10000) : "",
  };
}

function mergePeriodCommentary(canonical: PersonalWeeklyCurrentRow[], draft: PersonalWeeklyCurrentRow[]) {
  const byId = new Map(draft.map((row) => [row.taskId, row]));
  return canonical.map((row) => {
    const commentary = byId.get(row.taskId);
    if (!commentary) return row;
    const result = { ...row } as PersonalWeeklyCurrentRow & Record<string, unknown>;
    for (const key of ["commentary", "resultText", "notes", "periodCommentary"]) {
      if (typeof commentary[key] === "string") result[key] = commentary[key];
    }
    return result;
  });
}

export function buildPersonalWeeklySnapshot(
  loaded: PersonalWeeklyReportLoad,
  draftPayload: Record<string, unknown>,
  difficulties: string,
) {
  const validation = validatePersonalWeeklyDraft(draftPayload);
  if (!validation.ok) throw Object.assign(new Error(validation.message), { code: "22023" });
  const draft = validation.value;
  const currentRows = mergePeriodCommentary(
    loaded.currentRows,
    draft.currentRows,
  );
  const allowedNext = new Set(loaded.nextRows.map((row) => row.taskId));
  const nextRows = draft.nextRows.filter((row) => allowedNext.has(row.taskId));
  return {
    employee: loaded.employee ? {
      full_name: loaded.employee.full_name ?? null,
      department_id: loaded.employee.department_id ?? null,
      department_name: (loaded.employee.departments as Record<string, unknown> | null)?.name ?? loaded.employee.department_name ?? null,
      job_title_name: (loaded.employee.job_titles as Record<string, unknown> | null)?.name ?? loaded.employee.job_title_name ?? null,
    } : null,
    period: loaded.period.current,
    currentRows,
    nextRows,
    proposals: loaded.proposals,
    difficulties: difficulties.slice(0, 10000),
    completedAt: new Date().toISOString(),
  };
}

export async function savePersonalWeeklyDraft(actorId: string, input: Input): Promise<PersonalWeeklyResult<PersonalWeeklyReportRow>> {
  try {
    const saved = await saveRepository(actorId, mutationInput(input));
    return saved.ok ? saved : { ok: false, error: reportError(saved.error) };
  } catch (error) {
    return { ok: false, error: reportError(error) };
  }
}

export async function completePersonalWeeklyReport(actorId: string, input: Input): Promise<PersonalWeeklyResult<PersonalWeeklyReportRow>> {
  try {
    const mutation = mutationInput(input);
    const loaded = await getPersonalWeeklyReport(actorId, personalWeeklyPeriod(mutation.period.start));
    if (loaded.report?.status === "COMPLETED") return { ok: true, data: loaded.report };
    const snapshot = buildPersonalWeeklySnapshot(loaded, mutation.draftPayload, mutation.difficulties);
    const completed = await completeRepository(actorId, { ...mutation, draftPayload: snapshot });
    return completed.ok ? completed : { ok: false, error: reportError(completed.error) };
  } catch (error) {
    return { ok: false, error: reportError(error) };
  }
}

export async function reopenPersonalWeeklyReport(actorId: string, reportId: string, reason: string): Promise<PersonalWeeklyResult<PersonalWeeklyReportRow>> {
  try {
    const trimmed = typeof reason === "string" ? reason.trim() : "";
    if (trimmed.length < 5 || trimmed.length > 500) {
      return { ok: false, error: { code: "22023", message: "Reopen reason must be 5-500 characters" } };
    }
    const result = await reopenRepository(actorId, reportId, trimmed);
    return result.ok ? result : { ok: false, error: reportError(result.error) };
  } catch (error) {
    return { ok: false, error: reportError(error) };
  }
}

export async function reopenPersonalWeeklyReportRequest(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard;
  const input = await request.json().catch(() => null) as Input | null;
  if (!input || typeof input !== "object" || typeof input.reportId !== "string" || typeof input.reason !== "string") {
    return { ok: false as const, response: apiError("invalid_request", 400) };
  }
  const result = await reopenPersonalWeeklyReport(guard.actor.id, input.reportId, input.reason);
  return result.ok ? { ok: true as const, data: result.data } : { ok: false as const, response: rpcFailure(result.error) };
}

export async function loadPersonalWeeklyReport(request: Request): Promise<{ ok: true; data: PersonalWeeklyReportLoad } | { ok: false; response: Response }> {
  const guard = await requireReadActor();
  if (!guard.ok) return guard;
  try {
    const params = new URL(request.url).searchParams;
    const reportId = params.get("report")?.trim() || undefined;
    const period = periodFromInput({ periodStart: params.get("periodStart") ?? params.get("period") ?? undefined });
    const data = await getPersonalWeeklyReport(guard.actor.id, period, { reportId, isAdmin: guard.actor.role_code === "admin" });
    return { ok: true, data };
  } catch (error) {
    const mapped = reportError(error);
    if (mapped.code === "42501") return { ok: false, response: apiError("forbidden", 403) };
    if (mapped.code === "22023") return { ok: false, response: apiError("invalid_request", 400) };
    if (mapped.code === "P0002") return { ok: false, response: apiError("not_found", 404) };
    return { ok: false, response: rpcFailure(mapped) };
  }
}

export async function savePersonalWeeklyDraftRequest(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard;
  const input = await request.json().catch(() => null) as Input | null;
  if (!input || typeof input !== "object") return { ok: false as const, response: apiError("invalid_request", 400) };
  const result = await savePersonalWeeklyDraft(guard.actor.id, input);
  return result.ok ? { ok: true as const, data: result.data } : { ok: false as const, response: rpcFailure(result.error) };
}

export async function completePersonalWeeklyReportRequest(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard;
  const input = await request.json().catch(() => null) as Input | null;
  if (!input || typeof input !== "object") return { ok: false as const, response: apiError("invalid_request", 400) };
  const result = await completePersonalWeeklyReport(guard.actor.id, input);
  return result.ok ? { ok: true as const, data: result.data } : { ok: false as const, response: rpcFailure(result.error) };
}
