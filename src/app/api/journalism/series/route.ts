import { journalismStructureHandlers } from "@/lib/journalismStructureHandlers";
import { apiError, apiJson, requireReadActor } from "@/lib/serverApi";
import { canUseJournalism } from "@/lib/journalismScope.mjs";
import { listJournalismStructureFilters } from "@/lib/journalismStructureRepository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  if (!canUseJournalism({ roleCode: guard.actor.role_code, departmentCode: guard.actor.department_code, rbacPermissions: guard.actor.rbacPermissions })) return apiError("forbidden", 403);
  const params = new URL(request.url).searchParams;
  const result = await listJournalismStructureFilters(guard.actor, params.get("topicId"), params.get("seriesId"));
  return apiJson({ series: result.series, topics: result.topics });
}

export async function POST(request: Request) {
  return journalismStructureHandlers.createSeries(request);
}
