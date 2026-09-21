import { apiError, apiJson, readJsonObject, requireMutationActor, requireReadActor, rpcFailure } from "@/lib/serverApi";
import { validateEventAssignmentInput } from "@/lib/eventAssignmentValidation";
import { workScheduleRepository } from "@/lib/workScheduleRepository";

function validRange(from: string, to: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;
}

function canManage(actor: { role_code: string; is_department_manager: boolean }) {
  return ["admin", "tong_bien_tap", "pho_tong_bien_tap"].includes(actor.role_code) || actor.is_department_manager;
}

function parsed(body: Record<string, unknown>) {
  const reporterIds = Array.isArray(body.reporterIds) && body.reporterIds.every((id) => typeof id === "string")
    ? body.reporterIds as string[] : [];
  const input = {
    title: typeof body.title === "string" ? body.title.trim() : "",
    eventType: typeof body.eventType === "string" ? body.eventType.trim() : "",
    workDate: typeof body.workDate === "string" ? body.workDate : "",
    endDate: typeof body.endDate === "string" ? body.endDate : "",
    startTime: typeof body.startTime === "string" ? body.startTime : "",
    endTime: typeof body.endTime === "string" ? body.endTime : "",
    reporterIds,
  };
  return validateEventAssignmentInput(input).ok ? {
    ...input,
    location: typeof body.location === "string" ? body.location.trim().slice(0, 500) || null : null,
    notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) || null : null,
    id: typeof body.id === "string" ? body.id : undefined,
    workflowRevision: typeof body.workflowRevision === "number" && Number.isSafeInteger(body.workflowRevision)
      ? body.workflowRevision : undefined,
  } : null;
}

export async function GET(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "2000-01-01";
  const to = params.get("to") ?? "2100-12-31";
  if (!validRange(from, to)) return apiError("invalid_request", 400);
  const result = await workScheduleRepository.listEventAssignments(
    from, to, guard.actor.id,
    ["admin", "tong_bien_tap", "pho_tong_bien_tap"].includes(guard.actor.role_code)
      ? "global"
      : guard.actor.is_department_manager ? "department" : "self",
    guard.actor.department_id,
  );
  return result.ok ? apiJson({ rows: result.rows }) : rpcFailure(result.error);
}

export async function POST(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  if (!canManage(guard.actor)) return apiError("forbidden", 403);
  const input = parsed((await readJsonObject(request)) ?? {});
  if (!input || (input.id && input.workflowRevision === undefined)) return apiError("invalid_request", 400);
  const result = await workScheduleRepository.saveEventAssignment(guard.actor.id, input);
  return result.ok ? apiJson({ row: result.row }) : rpcFailure(result.error);
}

export async function PATCH(request: Request) {
  const guard = await requireMutationActor();
  if (!guard.ok) return guard.response;
  if (!canManage(guard.actor)) return apiError("forbidden", 403);
  const body = (await readJsonObject(request)) ?? {};
  const id = typeof body.id === "string" ? body.id : "";
  const action = body.action === "cancel" || body.action === "complete" ? body.action : null;
  const revision = typeof body.workflowRevision === "number" && Number.isSafeInteger(body.workflowRevision)
    ? body.workflowRevision : null;
  if (!id || !action || revision === null) return apiError("invalid_request", 400);
  const result = await workScheduleRepository.setEventAssignmentStatus(guard.actor.id, id, revision, action);
  return result.ok ? apiJson({ row: result.row }) : rpcFailure(result.error);
}
