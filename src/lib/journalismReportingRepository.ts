import "server-only";

import type { AuthorizationActor } from "@/lib/authorization";
import { getTaskScopeTerms } from "@/lib/taskRepository";
import { publicationReportDto } from "@/lib/journalismManualPublicationValidation";
import { serverSupabase } from "@/lib/serverSupabase";
import {
  REPORTING_ATTENTION_LIMIT,
  REPORTING_DEFAULT_LIMIT,
  REPORTING_RECENT_LIMIT,
  REPORTING_DATE_BASIS,
} from "@/lib/journalismReportingFilters.mjs";
import { deriveJournalismReportingMetrics } from "@/lib/journalismReportingMetrics.mjs";
import { canUseReportingDepartment } from "@/lib/journalismReportingScope.mjs";
import type { JournalismPublicationReportDto } from "@/lib/taskContracts";

export type JournalismReportingQuery = {
  fromDate: string;
  toDate: string;
  departmentId: string | null;
  assigneeId: string | null;
  topicId: string | null;
  seriesId: string | null;
  status: string | null;
  publicationStatus: string | null;
  verificationStatus: string | null;
};

export type JournalismReportingTaskRow = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  due_time: string | null;
  created_at: string;
  assignee_id: string | null;
  department_id: string | null;
  assignee: { full_name: string | null } | null;
  department: { code: string; name: string } | null;
  topics: Array<{ id: string; name: string }>;
  series: Array<{ id: string; name: string }>;
  report: JournalismPublicationReportDto | null;
};

export type JournalismReportingResult = ReturnType<typeof deriveJournalismReportingMetrics> & {
  dateBasis: typeof REPORTING_DATE_BASIS;
  fromDate: string;
  toDate: string;
  truncated: boolean;
};

type RepositoryError = { code?: string | null };
type RepositoryResult<T> = { ok: true; data: T } | { ok: false; error: RepositoryError };

const ok = <T>(data: T): RepositoryResult<T> => ({ ok: true, data });
const fail = <T>(error: { code?: string | null }): RepositoryResult<T> => ({ ok: false, error: { code: error.code ?? null } });

const one = <T>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null;

const todayVietnam = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

function reportingFields(query: JournalismReportingQuery) {
  const topicFilter = query.topicId ? ",topic_filter:editorial_topic_tasks!inner(topic_id)" : "";
  const seriesFilter = query.seriesId ? ",series_filter:editorial_series_items!inner(series_id)" : "";
  return [
    "id,title,status,due_date,due_time,created_at,assignee_id,department_id,assignee:staff_users!tasks_assignee_id_fkey(full_name),department:departments!inner(code,name)",
    `journalism:journalism_task_details!inner(task_id,publication_status,published_at,topic_links:editorial_topic_tasks(topic:editorial_topics(id,name)),series_links:editorial_series_items(task_id,position,series:editorial_series(id,name)),publication_report:journalism_publication_reports(id,task_id,publication_url,published_title,published_at,note,reported_by,created_at,updated_at,reporter:staff_users!journalism_publication_reports_reported_by_fkey(full_name),verification_history:journalism_publication_verifications(id,publication_report_id,decision,note,verified_by,publication_report_updated_at,created_at,verifier:staff_users!journalism_publication_verifications_verified_by_fkey(full_name)))${topicFilter}${seriesFilter})`,
  ].join(",");
}

function normalizeTask(value: unknown): JournalismReportingTaskRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const journalism = one(row.journalism) as Record<string, unknown> | null;
  if (typeof row.id !== "string" || typeof row.title !== "string" || typeof row.status !== "string" || typeof row.created_at !== "string") return null;
  const topicRows = Array.isArray(journalism?.topic_links) ? journalism.topic_links : [];
  const topics = topicRows.flatMap((item) => {
    const topic = one((item as { topic?: object | object[] | null }).topic);
    return topic && typeof topic === "object" && typeof (topic as { id?: unknown }).id === "string" && typeof (topic as { name?: unknown }).name === "string"
      ? [{ id: (topic as { id: string }).id, name: (topic as { name: string }).name }] : [];
  });
  const seriesRows = Array.isArray(journalism?.series_links) ? journalism.series_links : [];
  const series = seriesRows.flatMap((item) => {
    const seriesValue = one((item as { series?: object | object[] | null }).series);
    return seriesValue && typeof seriesValue === "object" && typeof (seriesValue as { id?: unknown }).id === "string" && typeof (seriesValue as { name?: unknown }).name === "string"
      ? [{ id: (seriesValue as { id: string }).id, name: (seriesValue as { name: string }).name }] : [];
  });
  const report = publicationReportDto(one(journalism?.publication_report));
  const assignee = one(row.assignee as { full_name?: string | null } | Array<{ full_name?: string | null }> | null);
  const department = one(row.department as { code?: string; name?: string } | Array<{ code?: string; name?: string }> | null);
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    due_date: typeof row.due_date === "string" ? row.due_date : null,
    due_time: typeof row.due_time === "string" ? row.due_time : null,
    created_at: row.created_at,
    assignee_id: typeof row.assignee_id === "string" ? row.assignee_id : null,
    department_id: typeof row.department_id === "string" ? row.department_id : null,
    assignee: assignee ? { full_name: assignee.full_name ?? null } : null,
    department: department?.name && department.code ? { code: department.code, name: department.name } : null,
    topics: [...new Map(topics.map((topic) => [topic.id, topic] as const)).values()],
    series: [...new Map(series.map((item) => [item.id, item] as const)).values()],
    report,
  };
}

export async function loadJournalismReporting(
  actor: AuthorizationActor,
  query: JournalismReportingQuery,
): Promise<RepositoryResult<JournalismReportingResult>> {
  if (!canUseReportingDepartment(actor, query.departmentId)) {
    return ok({
      ...deriveJournalismReportingMetrics([], 0, todayVietnam(), { recent: REPORTING_RECENT_LIMIT, attention: REPORTING_ATTENTION_LIMIT }),
      dateBasis: REPORTING_DATE_BASIS,
      fromDate: query.fromDate,
      toDate: query.toDate,
      truncated: false,
    });
  }
  const scope = await getTaskScopeTerms(actor);
  if (!scope.ok) return scope;
  let dbQuery = serverSupabase
    .from("tasks")
    .select(reportingFields(query), { count: "exact" })
    .order("created_at", { ascending: false })
    .gte("created_at", `${query.fromDate}T00:00:00+07:00`)
    .lte("created_at", `${query.toDate}T23:59:59.999+07:00`)
    .neq("task_category", "duty")
    .eq("departments.code", "editorial")
    .range(0, REPORTING_DEFAULT_LIMIT - 1);
  if (scope.data.length > 0) dbQuery = dbQuery.or(scope.data.join(","));
  if (query.status !== "cancelled") dbQuery = dbQuery.neq("status", "cancelled");
  if (query.departmentId) dbQuery = dbQuery.eq("department_id", query.departmentId);
  if (query.assigneeId) dbQuery = dbQuery.eq("assignee_id", query.assigneeId);
  if (query.status) dbQuery = dbQuery.eq("status", query.status);
  if (query.publicationStatus) dbQuery = dbQuery.eq("journalism_task_details.publication_status", query.publicationStatus);
  if (query.topicId) dbQuery = dbQuery.eq("journalism_task_details.topic_filter.topic_id", query.topicId);
  if (query.seriesId) dbQuery = dbQuery.eq("journalism_task_details.series_filter.series_id", query.seriesId);
  const { data, error, count } = await dbQuery;
  if (error) return fail(error);
  const rows = (data ?? []).map(normalizeTask).filter((row): row is JournalismReportingTaskRow => row !== null);
  const filteredRows = query.verificationStatus
    ? rows.filter((row) => row.report?.verification_status === query.verificationStatus)
    : rows;
  const total = filteredRows.length;
  return ok({
    ...deriveJournalismReportingMetrics(filteredRows, total, todayVietnam(), { recent: REPORTING_RECENT_LIMIT, attention: REPORTING_ATTENTION_LIMIT }),
    dateBasis: REPORTING_DATE_BASIS,
    fromDate: query.fromDate,
    toDate: query.toDate,
    truncated: (count ?? rows.length) > REPORTING_DEFAULT_LIMIT,
  });
}
