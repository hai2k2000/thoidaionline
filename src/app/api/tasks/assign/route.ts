import { taskHandlers } from "@/lib/taskHandlers";
import { requireReadActor, apiError, apiJson, asUuid } from "@/lib/serverApi";
import { taskAssignmentRepository } from "@/lib/taskAssignmentRepository";

export async function GET(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  if (guard.actor.role_code !== "admin") return apiError("forbidden", 403);
  const selected = new URL(request.url).searchParams.get("onBehalfOfId");
  const assigners = await taskAssignmentRepository.assigners();
  if (!assigners) return apiError("service_unavailable", 503);
  if (selected === null) return apiJson({ assigners: assigners.map(({ id, label }) => ({ id, label })) });
  if (!asUuid(selected)) return apiError("invalid_request", 400);
  const assigner = assigners.find((person) => person.id === selected);
  if (!assigner) return apiError("forbidden", 403);
  const options = await taskAssignmentRepository.options(assigner.actor);
  return options.ok ? apiJson({ ...options, roleCode: assigner.actor.roleCode }) : apiError("service_unavailable", 503);
}

export async function POST(request: Request) {
  return taskHandlers.assign(request);
}
