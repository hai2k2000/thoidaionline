import "server-only";
import { formatDateOnlyVN } from "@/lib/businessDate.mjs";
import { serverSupabase } from "@/lib/serverSupabase";
import type { ServerAuthUser } from "@/lib/serverSession";
import { taskRepository } from "@/lib/taskRepository";
import { dutyTaskRepository } from "@/lib/dutyTaskRepository";
import { workScheduleRepository } from "@/lib/workScheduleRepository";
import { applyJournalismExcludeFilter } from "@/lib/taskFilters.mjs";
import { canReviewAnyLeave, canReviewAnyPersonalPlan, getApprovalCapabilities } from "@/lib/rbac/approval";
import { getPhase2Navigation } from "@/components/phase2Navigation";
import { canUseJournalism } from "@/lib/journalismScope.mjs";
import { deskCopy } from "@/lib/deskHomeCopy.mjs";
import { announcementRepository } from "@/lib/announcementRepository";
import { sharedLibraryRepository } from "@/lib/sharedLibraryRepository";
import { buildDeskTodayItems, isDeskScheduleVisible, mergeDeskApprovalItems, pickDeskShortcuts, vietnamToday } from "@/lib/deskHome.mjs";

type Row = Record<string, unknown>;
type Result<T> = { ok: true; value: T } | { ok: false };
export type DeskTodayItem = { id: string; title: string; href: string; state: "overdue" | "today" | "soon"; label: string };
export type DeskApprovalItem = { id: string; title: string; subtitle: string; href: string; action: string };
export type DeskScheduleItem = { id: string; time: string; title: string; location: string; pending: boolean };
export type DeskData = {
  today: Result<{ items: DeskTodayItem[]; overdueCount: number; todayCount: number }>;
  approvals: Result<{ items: DeskApprovalItem[]; total: number; showQueueLink: boolean }> | null;
  schedule: Result<{ duty: DeskScheduleItem[]; personal: DeskScheduleItem[]; leadership: DeskScheduleItem[] | null }>;
  shortcuts: Result<Array<{ id: string; label: string; href: string }>>;
  announcements: Result<Array<{ id: string; title: string; important: boolean; created_at: string }>>;
  library: Result<Array<{ id: string; kind: string; title: string; url: string | null; created_at: string }>>;
};

const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const failed = <T,>(): Result<T> => ({ ok: false });
const chunks = <T,>(rows: T[], size = 40) => Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size));
const dateShift = (date: string, days: number) => new Date(Date.parse(date + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10);
const isQueueReviewer = (user: ServerAuthUser) => ["admin", "tong_bien_tap", "pho_tong_bien_tap"].includes(user.role_code) || user.is_department_manager;
const actorFor = (user: ServerAuthUser) => ({ id: user.id, departmentId: user.department_id, departmentCode: user.department_code, canAccessJournalism: canUseJournalism({ roleCode: user.role_code, departmentCode: user.department_code, rbacPermissions: user.rbacPermissions }), roleCode: user.role_code, roleLevel: user.role_level, isDepartmentManager: user.is_department_manager, permissions: user.permissions });
const relationName = (value: unknown) => value && typeof value === "object" ? String((value as Row).name ?? "") : "";
const fullName = (value: unknown) => value && typeof value === "object" ? String((value as Row).full_name ?? "") : "";

export async function loadTodayBlock(user: ServerAuthUser, today: string): Promise<Result<{ items: DeskTodayItem[]; overdueCount: number; todayCount: number }>> {
  const fields = "id,title,status,due_date,due_time,completion_submitted_at,completed_at,journalism:journalism_task_details!left(task_id)";
  let directQuery = serverSupabase.from("tasks").select(fields).or("owner_id.eq." + user.id + ",assignee_id.eq." + user.id).in("status", ["new", "in_progress", "blocked", "rejected"]).neq("task_category", "duty").not("due_date", "is", null).lte("due_date", dateShift(today, 3)).limit(200);
  directQuery = applyJournalismExcludeFilter(directQuery);
  const participants = await serverSupabase.from("task_assignees").select("task_id").eq("user_id", user.id).eq("assignment_role", "assignee");
  if (participants.error) return failed();
  const participantRows: Row[] = [];
  for (const batch of chunks((participants.data ?? []).map((row) => row.task_id))) {
    if (!batch.length) continue;
    let query = serverSupabase.from("tasks").select(fields).in("id", batch).in("status", ["new", "in_progress", "blocked", "rejected"]).neq("task_category", "duty").not("due_date", "is", null).lte("due_date", dateShift(today, 3));
    query = applyJournalismExcludeFilter(query);
    const result = await query;
    if (result.error) return failed();
    participantRows.push(...((result.data ?? []) as Row[]));
  }
  const direct = await directQuery;
  if (direct.error) return failed();
  const rows = [...((direct.data ?? []) as Row[]), ...participantRows];
  const unique = [...new Map(rows.map((row) => [String(row.id), row])).values()];
  const built = buildDeskTodayItems(unique, new Date());
  return ok({ ...built, items: built.items.map((item) => ({ ...item, state: item.state as DeskTodayItem["state"] })) });
}

export async function loadApprovalsBlock(user: ServerAuthUser, today: string): Promise<Result<{ items: DeskApprovalItem[]; total: number; showQueueLink: boolean }> | null> {
  const capabilities = await getApprovalCapabilities(user.id);
  const showQueueLink = isQueueReviewer(user);
  const lists: DeskApprovalItem[][] = [];
  if (showQueueLink) {
    for (const queue of ["assignment", "completion"] as const) {
      const result = await taskRepository.listApprovalQueue(actorFor(user), queue);
      if (!result.ok) return failed();
      lists.push(result.data.items.map((item) => ({ id: String(item.id), title: String(item.title), subtitle: queue === "assignment" ? deskCopy.subtitleAssignment : deskCopy.subtitleCompletion, href: "/tasks/" + item.id, action: queue === "assignment" ? deskCopy.actionApproveAssignment : deskCopy.actionApproveCompletion })));
    }
  }
  let reviewQuery = serverSupabase.from("tasks").select("id,title,project_id,journalism:journalism_task_details!left(task_id)").eq("status", "pending_review").eq("reviewer_id", user.id).neq("task_category", "duty").limit(20);
  reviewQuery = applyJournalismExcludeFilter(reviewQuery);
  const review = await reviewQuery;
  if (review.error) return failed();
  lists.push(((review.data ?? []) as Row[]).map((row) => ({ id: String(row.id), title: String(row.title ?? ""), subtitle: row.project_id ? deskCopy.schedulePending : deskCopy.subtitleScore, href: row.project_id ? "/tasks/" + row.id : "/tasks/" + row.id + "#task-scoring-form", action: row.project_id ? deskCopy.actionApprove : deskCopy.actionScore })));
  const canLeave = canReviewAnyLeave(capabilities);
  const canPlan = canReviewAnyPersonalPlan(capabilities);
  if (canLeave) {
    const leave = await serverSupabase.rpc("api_list_reviewable_leave_requests", { p_actor: user.id, p_from: dateShift(today, -60), p_to: dateShift(today, 365) });
    if (leave.error) return failed();
    const ids = (leave.data ?? []).map((row: Row) => String(row.id));
    if (ids.length) {
      const rows = await serverSupabase.from("leave_requests").select("id,start_date,end_date,requester:staff_users!leave_requests_requester_id_fkey(full_name)").in("id", ids);
      if (rows.error) return failed();
      lists.push(((rows.data ?? []) as Row[]).map((row) => ({ id: "leave-" + row.id, title: deskCopy.leavePrefix + ": " + (fullName(row.requester) || deskCopy.staffFallback), subtitle: formatDateOnlyVN(String(row.start_date)) + " - " + formatDateOnlyVN(String(row.end_date)), href: "/attendance", action: deskCopy.actionApprove })));
    }
  }
  if (canPlan) {
    const plans = await workScheduleRepository.listReviewablePersonal(user.id);
    if (!plans.ok) return failed();
    const planRows = plans.rows as unknown as Row[];
    lists.push(planRows.map((row) => ({ id: "plan-" + row.id, title: String(row.title ?? ""), subtitle: fullName(row.creator), href: "/work-schedule/staff", action: deskCopy.actionApprove })));
  }
  const items = mergeDeskApprovalItems(lists);
  return showQueueLink || canLeave || canPlan || items.length ? ok({ items, total: items.length, showQueueLink }) : null;
}

export async function loadScheduleBlock(user: ServerAuthUser, today: string): Promise<Result<{ duty: DeskScheduleItem[]; personal: DeskScheduleItem[]; leadership: DeskScheduleItem[] | null }>> {
  const [duty, personal] = await Promise.all([dutyTaskRepository.schedule(today, today), workScheduleRepository.listPersonal(today, today, user.id)]);
  if (!duty.ok || !personal.ok) return failed();
  const leadershipAllowed = ["admin", "tong_bien_tap", "pho_tong_bien_tap", "truong_phong"].includes(user.role_code) || user.is_department_manager;
  const leadership = leadershipAllowed ? await workScheduleRepository.listOrganization(today, today) : null;
  if (leadership && !leadership.ok) return failed();
  const dutyItems = [...new Map((duty.rows ?? []).map((row) => { const name = fullName(row.assignee); return [name, name ? { id: "duty-" + name, time: deskCopy.allDay, title: name, location: relationName(row.departments), pending: false } : null] as const; }).filter((entry): entry is [string, DeskScheduleItem] => entry[1] !== null)).values()];
  const line = (row: Row): DeskScheduleItem => ({ id: String(row.id), time: row.start_time ? String(row.start_time).slice(0, 5) : deskCopy.allDay, title: String(row.title ?? ""), location: String(row.location ?? relationName(row.departments)), pending: row.approval_status === "PENDING_APPROVAL" });
  return ok({ duty: dutyItems, personal: (personal.rows ?? []).filter(isDeskScheduleVisible).map(line), leadership: leadership ? (leadership.rows as unknown as Row[]).filter(isDeskScheduleVisible).map(line) : null });
}

export async function loadAnnouncementsBlock(): Promise<DeskData["announcements"]> { const result = await announcementRepository.listActive(3); return result.error ? failed() : ok((result.data ?? []).map((row) => ({ id: String(row.id), title: String(row.title ?? ""), important: Boolean(row.important), created_at: String(row.created_at) }))); }
export async function loadLibraryBlock(): Promise<DeskData["library"]> { const result = await sharedLibraryRepository.listRecent(3); return result.error ? failed() : ok((result.data ?? []).map((row) => ({ id: String(row.id), kind: String(row.kind), title: String(row.title ?? ""), url: row.url ? String(row.url) : null, created_at: String(row.created_at) }))); }

export async function loadShortcutsBlock(user: ServerAuthUser): Promise<Result<Array<{ id: string; label: string; href: string }>>> {
  const navigation = getPhase2Navigation({ roleCode: user.role_code, hasProjectMembership: false, departmentCode: user.department_code, canAccessJournalism: canUseJournalism({ roleCode: user.role_code, departmentCode: user.department_code, rbacPermissions: user.rbacPermissions }), canAssignTask: user.permissions.can_assign_task, canEvaluateStep1: user.permissions.can_evaluate_step1, canEvaluateStep2: user.permissions.can_evaluate_step2, isDepartmentManager: user.is_department_manager, canManageRubrics: user.permissions.can_manage_rubrics, canManageUsers: user.permissions.can_manage_users, canManagePermissions: user.permissions.can_manage_permissions, canViewDatabase: true, rbacPermissionScopes: user.rbacPermissionScopes });
  return ok(pickDeskShortcuts(navigation));
}

export async function loadDeskData(user: ServerAuthUser): Promise<DeskData> {
  const today = vietnamToday();
  const results = await Promise.allSettled([loadTodayBlock(user, today), loadApprovalsBlock(user, today), loadScheduleBlock(user, today), loadShortcutsBlock(user), loadAnnouncementsBlock(), loadLibraryBlock()]);
  const value = <T,>(index: number): T => { const result = results[index]; return result.status === "fulfilled" ? result.value as T : failed() as T; };
  return { today: value<DeskData["today"]>(0), approvals: value<DeskData["approvals"]>(1), schedule: value<DeskData["schedule"]>(2), shortcuts: value<DeskData["shortcuts"]>(3), announcements: value<DeskData["announcements"]>(4), library: value<DeskData["library"]>(5) };
}
