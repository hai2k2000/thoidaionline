import "server-only";

import type { AuthorizationActor } from "@/lib/authorization";
import type { RepositoryResult } from "@/lib/taskContracts";
import { canUseJournalism } from "@/lib/journalismScope.mjs";
import { serverSupabase } from "@/lib/serverSupabase";
import { calendarRange, type JournalismCalendarQuery } from "@/lib/journalismCalendar";
import { getTaskScopeTerms, taskRepository } from "@/lib/taskRepository";
import { calendarActorScope as policyCalendarActorScope, plannedPublicationPatch as buildPlannedPublicationPatch } from "@/lib/journalismCalendarRepositoryPolicy.mjs";

export type JournalismCalendarTask = {
  id: string;
  title: string;
  status: string;
  assigneeId: string | null;
  assigneeName: string | null;
  plannedPublicationAt: string | null;
  publicationStatus: string;
  publishedAt: string | null;
  topic: { id: string; name: string } | null;
  series: { id: string; name: string } | null;
};

export type JournalismCalendarResult = {
  from: string;
  to: string;
  tasks: JournalismCalendarTask[];
};

type CalendarActor = AuthorizationActor & { departmentCode?: string | null; rbacPermissions?: string[] };

export function calendarActorScope(actor: CalendarActor) {
  if (!policyCalendarActorScope(actor)) return null;
  if (!canUseJournalism({
    roleCode: actor.roleCode,
    departmentCode: actor.departmentCode,
    rbacPermissions: actor.rbacPermissions,
  })) return null;
  return policyCalendarActorScope(actor) as { departmentId: string | null; scope: "all" | "assigned" };
}

export function plannedPublicationPatch(value: string | null) {
  return buildPlannedPublicationPatch(value);
}

const one = <T>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null;

export async function loadJournalismCalendar(actor: CalendarActor, query: JournalismCalendarQuery): Promise<RepositoryResult<JournalismCalendarResult>> {
  const scope = calendarActorScope(actor);
  const range = calendarRange(query.view, query.anchorDate);
  if (!scope) return { ok: true, data: { ...range, tasks: [] } };
  const taskScope = await getTaskScopeTerms(actor);
  if (!taskScope.ok) return taskScope;
  const topicFilter = query.topicId ? ",topic_filter:editorial_topic_tasks!inner(topic_id)" : "";
  const seriesFilter = query.seriesId ? ",series_filter:editorial_series_items!inner(series_id)" : "";
  let dbQuery = serverSupabase.from("tasks").select([
    "id,title,status,assignee_id,assignee:staff_users!tasks_assignee_id_fkey(full_name)",
    "department:departments!inner(code)",
    `journalism:journalism_task_details!inner(publication_status,planned_publication_at,published_at,topic_links:editorial_topic_tasks(topic:editorial_topics(id,name)),series_links:editorial_series_items(series:editorial_series(id,name))${topicFilter}${seriesFilter})`,
  ].join(","))
    .eq("department.code", "editorial")
    .neq("status", "cancelled")
    .order("planned_publication_at", { ascending: true, referencedTable: "journalism_task_details" });
  if (scope.scope === "assigned") dbQuery = dbQuery.or(`owner_id.eq.${actor.id},assignee_id.eq.${actor.id}`);
  if (taskScope.data.length > 0) dbQuery = dbQuery.or(taskScope.data.join(","));
  if (query.reporterId) dbQuery = dbQuery.eq("assignee_id", query.reporterId);
  if (query.publicationStatus) dbQuery = dbQuery.eq("journalism_task_details.publication_status", query.publicationStatus);
  if (query.topicId) dbQuery = dbQuery.eq("journalism_task_details.topic_filter.topic_id", query.topicId);
  if (query.seriesId) dbQuery = dbQuery.eq("journalism_task_details.series_filter.series_id", query.seriesId);
  const { data, error } = await dbQuery;
  if (error) return { ok: false, error: { code: error.code ?? null } };
  const tasks = (data ?? []).map((raw) => {
    const row = raw as unknown as Record<string, unknown>;
    const journalism = (one(row.journalism as Record<string, unknown> | Record<string, unknown>[] | null) ?? {}) as Record<string, unknown>;
    const topicRow = Array.isArray(journalism.topic_links) ? journalism.topic_links[0] as Record<string, unknown> : null;
    const seriesRow = Array.isArray(journalism.series_links) ? journalism.series_links[0] as Record<string, unknown> : null;
    const topic = one(topicRow?.topic as { id: string; name: string } | Array<{ id: string; name: string }> | null);
    const series = one(seriesRow?.series as { id: string; name: string } | Array<{ id: string; name: string }> | null);
    const assignee = one(row.assignee as { full_name?: string | null } | Array<{ full_name?: string | null }> | null);
    return {
      id: row.id as string,
      title: row.title as string,
      status: row.status as string,
      assigneeId: typeof row.assignee_id === "string" ? row.assignee_id : null,
      assigneeName: assignee?.full_name ?? null,
      plannedPublicationAt: typeof journalism.planned_publication_at === "string" ? journalism.planned_publication_at : null,
      publicationStatus: journalism.publication_status as string,
      publishedAt: typeof journalism.published_at === "string" ? journalism.published_at : null,
      topic: topic ? { id: topic.id, name: topic.name } : null,
      series: series ? { id: series.id, name: series.name } : null,
    } satisfies JournalismCalendarTask;
  }).filter((task) => !task.plannedPublicationAt
    || (task.plannedPublicationAt.slice(0, 10) >= range.from && task.plannedPublicationAt.slice(0, 10) <= range.to));
  return { ok: true, data: { ...range, tasks } };
}

export async function updatePlannedPublicationDate(actor: CalendarActor, taskId: string, plannedPublicationAt: string | null): Promise<RepositoryResult<unknown>> {
  const scope = calendarActorScope(actor);
  if (!scope) return { ok: false, error: { code: "forbidden" } };
  const access = await taskRepository.access(taskId);
  if (!access.ok || !access.data) return { ok: false, error: { code: "not_found" } };
  const globalJournalismLeader = ["tong_bien_tap", "pho_tong_bien_tap"].includes(actor.roleCode);
  if (!globalJournalismLeader && access.data.departmentId !== actor.departmentId) return { ok: false, error: { code: "forbidden" } };
  if (scope.scope === "assigned" && ![access.data.ownerId, access.data.assigneeId, access.data.createdBy].includes(actor.id)) {
    return { ok: false, error: { code: "forbidden" } };
  }
  const detail = await serverSupabase.from("journalism_task_details")
    .select("publication_status,work_kind_id,location,editorial_notes")
    .eq("task_id", taskId).maybeSingle();
  if (detail.error || !detail.data) return { ok: false, error: { code: "not_found" } };
  const { data, error } = await serverSupabase.rpc("api_update_journalism_metadata_v1", {
    p_actor_id: actor.id,
    p_task_id: taskId,
    p_work_kind_id: detail.data.work_kind_id,
    p_planned_publication_at: plannedPublicationAt,
    p_location: detail.data.location,
    p_editorial_notes: detail.data.editorial_notes,
    p_expected_updated_at: null,
  });
  return error ? { ok: false, error: { code: error.code ?? null } } : { ok: true, data };
}
