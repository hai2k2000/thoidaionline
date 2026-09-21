import { apiError, apiJson, readJsonObject, requireMutationActor, requireReadActor, rpcFailure } from "@/lib/serverApi";
import { validateLocalPlanInterval } from "@/lib/personalPlanValidation";
import { workScheduleRepository, type WorkScheduleInput } from "@/lib/workScheduleRepository";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function validRange(from: string, to: string) {
  return DATE.test(from) && DATE.test(to) && from <= to;
}

function parsedInput(body: Record<string, unknown>): WorkScheduleInput | null {
  const planType = body.planType;
  const workDate = typeof body.workDate === "string" ? body.workDate : "";
  const endDate = typeof body.endDate === "string" ? body.endDate : "";
  const startTime = typeof body.startTime === "string" ? body.startTime : "";
  const endTime = typeof body.endTime === "string" ? body.endTime : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if ((planType !== "work" && planType !== "business" && planType !== "event")
    || !title || title.length > 500 || !DATE.test(workDate) || !DATE.test(endDate)
    || !TIME.test(startTime) || !TIME.test(endTime)
    || !validateLocalPlanInterval({ workDate, endDate, startTime, endTime }).ok) {
    return null;
  }
  const participantIds = Array.isArray(body.participantIds) && body.participantIds.every((id) => typeof id === "string")
    ? body.participantIds as string[] : [];
  if (participantIds.length > 50) return null;
  return {
    id: typeof body.id === "string" ? body.id : undefined,
    workDate,
    endDate,
    planType,
    startTime,
    endTime,
    title,
    location: typeof body.location === "string" ? body.location.trim().slice(0, 500) || null : null,
    notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) || null : null,
    participantIds,
  };
}

export async function GET(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "2000-01-01";
  const to = params.get("to") ?? "2100-12-31";
  if (!validRange(from, to)) return apiError("invalid_request", 400);
  const scope = params.get("scope") ?? "self";
  if (scope === "approval") {
    const canReview = guard.actor.role_code === "admin"
      || guard.actor.role_code === "tong_bien_tap"
      || guard.actor.role_code === "pho_tong_bien_tap"
      || guard.actor.is_department_manager;
    if (!canReview) return apiError("forbidden", 403);
    const result = await workScheduleRepository.listPendingPersonal(
      ["admin", "tong_bien_tap", "pho_tong_bien_tap"].includes(guard.actor.role_code)
        ? undefined : guard.actor.department_id,
    );
    return result.ok ? apiJson({ rows: result.rows }) : rpcFailure(result.error);
  }
  if (scope !== "self") return apiError("invalid_request", 400);
  const result = await workScheduleRepository.listPersonal(from, to, guard.actor.id);
  return result.ok ? apiJson({ rows: result.rows }) : rpcFailure(result.error);
}

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = (await readJsonObject(request)) ?? {};
  const input = parsedInput(body);
  if (!input) return apiError("invalid_request", 400);
  const expectedRevision = input.id === undefined
    ? null
    : typeof body.workflowRevision === "number" && Number.isSafeInteger(body.workflowRevision)
      ? body.workflowRevision : null;
  if (input.id !== undefined && expectedRevision === null) return apiError("invalid_request", 400);
  input.participantIds = [guard.actor.id];
  const result = await workScheduleRepository.savePersonal(guard.actor.id, input, expectedRevision);
  return result.ok ? apiJson({ row: result.row }) : rpcFailure(result.error);
}

export async function PATCH(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  const body = (await readJsonObject(request)) ?? {};
  const id = typeof body.id === "string" ? body.id : "";
  const action = body.action === "approve" || body.action === "reject" ? body.action : null;
  const workflowRevision = typeof body.workflowRevision === "number" && Number.isSafeInteger(body.workflowRevision)
    ? body.workflowRevision : null;
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!id || !action || workflowRevision === null || (action === "reject" && (note.length < 3 || note.length > 1000))) {
    return apiError("invalid_request", 400);
  }
  const result = await workScheduleRepository.reviewPersonal(guard.actor.id, id, action, note, workflowRevision);
  return result.ok ? apiJson({ row: result.row }) : rpcFailure(result.error);
}
