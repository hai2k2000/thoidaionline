import "server-only";

import { can } from "@/lib/rbac/authorization";
import { loadRbacActor } from "@/lib/rbac/repository";
import type { RbacActor } from "@/lib/rbac/types";
import { canManageJournalismStructure } from "@/lib/journalismStructureAuthorization";
import { serverSupabase } from "@/lib/serverSupabase";
import { canTaskAction, type AuthorizationActor, type TaskAccessSnapshot } from "@/lib/authorization";

export type JournalismStructureTopic = {
  id: string;
  name: string;
  description: string | null;
  department_id: string | null;
  is_active: boolean;
};

export type JournalismStructureSeries = {
  id: string;
  name: string;
  description: string | null;
  department_id: string | null;
  topic_id: string | null;
  is_active: boolean;
};

export type JournalismStructureDepartment = { id: string; name: string };

export type JournalismStructurePageData = {
  actor: RbacActor;
  scope: "all" | "department";
  topics: JournalismStructureTopic[];
  series: JournalismStructureSeries[];
  departments: JournalismStructureDepartment[];
};

export type JournalismTaskStructureOptions = {
  topics: JournalismStructureTopic[];
  series: JournalismStructureSeries[];
  canAssign: boolean;
};

export type JournalismSeriesOrderItem = { taskId: string; title: string; position: number; canView: boolean };

const visibleForManagement = (actor: RbacActor, departmentId: string | null) =>
  canManageJournalismStructure(actor, { departmentId });

const loadActor = async (user: { id: string; department_id: string | null }) => loadRbacActor(user);

export async function loadJournalismStructurePage(user: { id: string; full_name?: string; department_id: string | null }): Promise<JournalismStructurePageData | null> {
  const actor = await loadActor(user);
  const manageAll = actor.grants.some((grant) => grant.permissionCode === "journalism.structure.manage" && grant.scope === "all");
  const [topicsResult, seriesResult, departmentsResult] = await Promise.all([
    serverSupabase.from("editorial_topics").select("id,name,description,department_id,is_active").order("is_active", { ascending: false }).order("name"),
    serverSupabase.from("editorial_series").select("id,name,description,department_id,topic_id,is_active").order("is_active", { ascending: false }).order("name"),
    serverSupabase.from("departments").select("id,name").eq("active", true).order("name"),
  ]);
  if (topicsResult.error || seriesResult.error || departmentsResult.error) return null;
  return {
    actor,
    scope: manageAll ? "all" : "department",
    topics: (topicsResult.data ?? []).filter((row) => visibleForManagement(actor, row.department_id)) as JournalismStructureTopic[],
    series: (seriesResult.data ?? []).filter((row) => visibleForManagement(actor, row.department_id)) as JournalismStructureSeries[],
    departments: ((departmentsResult.data ?? []).filter((row) => manageAll || row.id === actor.departmentId)) as JournalismStructureDepartment[],
  };
}

export async function listJournalismStructureFilters(
  user: { id: string; department_id: string | null },
  selectedTopicId: string | null = null,
  selectedSeriesId: string | null = null,
) {
  const actor = await loadActor(user);
  const manageAll = actor.grants.some((grant) => grant.permissionCode === "journalism.structure.manage" && grant.scope === "all");
  const [topicsResult, seriesResult] = await Promise.all([
    serverSupabase.from("editorial_topics").select("id,name,description,department_id,is_active").order("name"),
    serverSupabase.from("editorial_series").select("id,name,description,department_id,topic_id,is_active").order("name"),
  ]);
  if (topicsResult.error || seriesResult.error) return { topics: [], series: [] };
  const assignAll = actor.grants.some((grant) => grant.permissionCode === "journalism.structure.assign" && grant.scope === "all");
  const known = (departmentId: string | null) => manageAll || assignAll || departmentId === null || departmentId === actor.departmentId;
  const topics = (topicsResult.data ?? []).filter((row) => known(row.department_id) && (row.is_active || row.id === selectedTopicId)) as JournalismStructureTopic[];
  const series = (seriesResult.data ?? []).filter((row) => known(row.department_id) && (row.is_active || row.id === selectedSeriesId)) as JournalismStructureSeries[];
  return { topics, series };
}

export async function loadJournalismTaskStructureOptions(
  user: { id: string; department_id: string | null },
  task: TaskAccessSnapshot,
  authorizationActor?: AuthorizationActor,
): Promise<JournalismTaskStructureOptions> {
  const actor = await loadActor(user);
  const resource = { kind: "task" as const, id: task.id, departmentId: task.departmentId, createdBy: task.createdBy, ownerId: task.ownerId, assigneeId: task.assigneeId, reviewerId: task.reviewerId, participantIds: task.participants.map((item) => item.userId) };
  const canAssign = canTaskAction(authorizationActor ?? { id: user.id, departmentId: user.department_id, roleCode: "", roleLevel: 0, permissions: {} as AuthorizationActor["permissions"] }, task, "view")
    && can(actor, "journalism.structure.assign", resource);
  const topicScope = task.departmentId ? `department_id.is.null,department_id.eq.${task.departmentId}` : "department_id.is.null";
  const [topicsResult, seriesResult] = await Promise.all([
    serverSupabase.from("editorial_topics").select("id,name,description,department_id,is_active").or(topicScope).eq("is_active", true).order("name"),
    serverSupabase.from("editorial_series").select("id,name,description,department_id,topic_id,is_active").or(topicScope).eq("is_active", true).order("name"),
  ]);
  return {
    topics: (topicsResult.data ?? []) as JournalismStructureTopic[],
    series: (seriesResult.data ?? []) as JournalismStructureSeries[],
    canAssign,
  };
}

export async function canManageStructures(user: { id: string; department_id: string | null }) {
  const actor = await loadActor(user);
  return actor.grants.some((grant) => grant.permissionCode === "journalism.structure.manage");
}

export async function loadJournalismSeriesOrder(
  user: { id: string; department_id: string | null; role_code: string; role_level: number; permissions: AuthorizationActor["permissions"] },
  seriesId: string,
) {
  const actor = await loadActor(user);
  const seriesResult = await serverSupabase.from("editorial_series").select("id,name,description,department_id,topic_id,is_active").eq("id", seriesId).maybeSingle();
  const itemsResult = await serverSupabase.from("editorial_series_items").select("task_id,position,tasks(id,title,department_id,created_by,owner_id,assignee_id,reviewer_id,self_claimable,task_type,status,departments(manager_id),task_assignees(user_id,assignment_role))").eq("series_id", seriesId).order("position");
  if (seriesResult.error || itemsResult.error || !seriesResult.data) return null;
  const authActor: AuthorizationActor = { id: user.id, departmentId: user.department_id, roleCode: user.role_code, roleLevel: user.role_level, permissions: user.permissions };
  const items = ((itemsResult.data ?? []) as unknown as Array<{ task_id: string; position: number; tasks: Record<string, unknown> | null }>).map((row) => {
    const task = row.tasks;
    if (!task) return { taskId: row.task_id, title: "", position: row.position, canView: false };
    const snapshot: TaskAccessSnapshot = {
      id: task.id as string,
      departmentId: task.department_id as string | null,
      createdBy: task.created_by as string | null,
      ownerId: task.owner_id as string | null,
      assigneeId: task.assignee_id as string | null,
      reviewerId: task.reviewer_id as string | null,
      departmentManagerId: (task.departments as { manager_id: string | null } | null)?.manager_id ?? null,
      selfClaimable: task.self_claimable as boolean,
      taskType: task.task_type as TaskAccessSnapshot["taskType"],
      status: task.status as string,
      participants: ((task.task_assignees as Array<{ user_id: string; assignment_role: "owner" | "assignee" | "watcher" }> | null) ?? []).map((participant) => ({ userId: participant.user_id, assignmentRole: participant.assignment_role })),
    };
    return { taskId: row.task_id, title: canTaskAction(authActor, snapshot, "view") ? String(task.title ?? "") : "", position: row.position, canView: canTaskAction(authActor, snapshot, "view") };
  });
  const canManage = seriesResult.data.is_active && can(actor, "journalism.structure.manage", { kind: "task", id: seriesId, departmentId: seriesResult.data.department_id, createdBy: null, ownerId: null, assigneeId: null, reviewerId: null });
  return { series: seriesResult.data as JournalismStructureSeries, items: items.filter((item) => item.canView), hasHiddenItems: items.some((item) => !item.canView), canManage };
}
