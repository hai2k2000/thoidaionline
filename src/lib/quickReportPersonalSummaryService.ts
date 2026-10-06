import "server-only";

import { apiError, requireReadActor } from "@/lib/serverApi";
import { getPersonalQuickReportSummary } from "@/lib/quickReportPersonalSummaryRepository";
import { DEFAULT_PERSONAL_QUICK_REPORT_PAGE_SIZE, MAX_PERSONAL_QUICK_REPORT_ROWS, personalQuickReportPeriodBounds, type PersonalQuickReportPeriod } from "@/lib/quickReportPersonalSummary";

const periods = new Set<PersonalQuickReportPeriod>(["week", "month", "range"]);
type SummaryLoadOptions = { pageSizeLimit?: number };

export async function loadPersonalQuickReportSummary(request: Request, options: SummaryLoadOptions = {}) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard;
  const actor = guard.actor;
  if (!actor.rbacPermissions.includes("task.quick_report.create")) return { ok: false as const, response: apiError("forbidden", 403) };
  const url = new URL(request.url);
  const requestedPeriod = url.searchParams.get("period") as PersonalQuickReportPeriod | null;
  const period = requestedPeriod && periods.has(requestedPeriod) ? requestedPeriod : "month";
  const bounds = personalQuickReportPeriodBounds(period, url.searchParams.get("from"), url.searchParams.get("to"));
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const pageSizeLimit = Math.min(MAX_PERSONAL_QUICK_REPORT_ROWS, Math.max(1, options.pageSizeLimit ?? DEFAULT_PERSONAL_QUICK_REPORT_PAGE_SIZE));
  const pageSize = Math.min(pageSizeLimit, Math.max(1, Number(url.searchParams.get("pageSize") ?? DEFAULT_PERSONAL_QUICK_REPORT_PAGE_SIZE) || DEFAULT_PERSONAL_QUICK_REPORT_PAGE_SIZE));
  const summary = await getPersonalQuickReportSummary(actor.id, bounds, page, pageSize);
  if (summary.error) return { ok: false as const, response: apiError("operation_failed", 500) };
  return { ok: true as const, data: { actor, period, ...bounds, report: summary.data } };
}