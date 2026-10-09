import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";
import { completionDateFromTaskTimestamp } from "@/lib/businessDate.mjs";
import {
  DEFAULT_PERSONAL_QUICK_REPORT_PAGE_SIZE,
  MAX_PERSONAL_QUICK_REPORT_ROWS,
  filterPersonalQuickReports,
  personalQuickReportMetrics,
  type PersonalQuickReportBounds,
  type PersonalQuickReportRow,
} from "@/lib/quickReportPersonalSummary";

export async function getPersonalQuickReportSummary(actorId: string, bounds: PersonalQuickReportBounds, page: number, pageSize = DEFAULT_PERSONAL_QUICK_REPORT_PAGE_SIZE) {
  const result = await serverSupabase.from("tasks")
    .select("id,title,description,status,workflow_type,report_work_date,start_date,completed_at,report_notes,owner_id,created_by", { count: "exact" })
    .eq("owner_id", actorId)
    .eq("workflow_type", "REPORT_ONLY")
    .gte("report_work_date", bounds.from)
    .lte("report_work_date", bounds.to)
    .order("report_work_date", { ascending: false })
    .limit(MAX_PERSONAL_QUICK_REPORT_ROWS);
  if (result.error) return { error: result.error };
  const rows = ((result.data ?? []) as unknown as Array<Omit<PersonalQuickReportRow, "completion_date"> & { completed_at: string | null }>).map((row) => ({ ...row, completion_date: completionDateFromTaskTimestamp(row.completed_at) }));
  const filtered = filterPersonalQuickReports(rows, actorId, bounds);
  const start = Math.max(0, (page - 1) * pageSize);
  return {
    error: null,
    data: {
      rows: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
      metrics: personalQuickReportMetrics(filtered),
    },
  };
}
