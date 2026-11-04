import "server-only";
import { serverSupabase } from "@/lib/serverSupabase";

export type ProjectMember = { project_id: string; user_id: string; role: "lead" | "deputy" | "member"; added_by: string; added_at: string; staff_users?: { id: string; full_name: string; active: boolean; roles?: { code: string } | null } | null };
export type Project = { id: string; code: string; name: string; description: string | null; status: "active" | "closed"; host_department_id: string; created_by: string; created_at: string; updated_at: string; closed_at: string | null; host_department?: { name: string } | null };
export type ProjectTask = { collaborator_ids?: string[]; id: string; project_id: string; title: string; status: string; assignee_id: string | null; reviewer_id: string | null; due_date: string | null; due_time?: string | null; completion_submitted_at?: string | null; completed_at?: string | null; priority: string; created_by: string | null; created_at: string; created_by_user?: { full_name: string } | { full_name: string }[] | null };
export type ProjectAssignmentInput = {
  title: string; description: string; assigneeId: string; reviewerId?: string | null; dueDate: string | null; dueTime: string | null;
  evaluationCriteria?: string | null; collaboratorIds?: string[]; watcherIds?: string[]; priority?: "low" | "normal" | "high" | "urgent"; attachmentUrl?: string | null;
};
type Result<T> = { ok: true; data: T } | { ok: false; error: { code?: string | null } };
const result = <T>(data: T, error: { code?: string | null } | null): Result<T> => error ? { ok: false, error: { code: error.code ?? null } } : { ok: true, data };
const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<Result<T>> => {
  const { data, error } = await serverSupabase.rpc(name, args);
  return result(data as T, error);
};

export type ProjectReader = { id: string; roleCode: string };
const PROJECT_FIELDS = "id,code,name,description,status,host_department_id,created_by,created_at,updated_at,closed_at,host_department:departments!projects_host_department_id_fkey(name)";
const canReadAll = (actor: ProjectReader) => ["admin", "tong_bien_tap"].includes(actor.roleCode);
const failure = (error: { code?: string | null }): { ok: false; error: { code: string | null } } => ({ ok: false, error: { code: error.code ?? null } });
const readAccess = async (actor: ProjectReader, projectId: string): Promise<Result<true>> => {
  if (canReadAll(actor)) return result(true, null);
  const q = await serverSupabase.from("project_members").select("user_id,staff_users!project_members_user_id_fkey!inner(active)").eq("project_id", projectId).eq("user_id", actor.id).eq("staff_users.active", true).maybeSingle();
  if (q.error) return failure(q.error);
  return q.data ? result(true, null) : failure({ code: "42501" });
};

export const projectRepository = {
  async hasMembership(actorId: string) {
    const q = await serverSupabase.from("project_members").select("project_id").eq("user_id", actorId).limit(1);
    return result(Boolean(q.data?.length), q.error);
  },
  async options() {
    const [staff, departments] = await Promise.all([
      serverSupabase.from("staff_users").select("id,full_name,department_id,roles(code)").eq("active", true).order("full_name"),
      serverSupabase.from("departments").select("id,name").eq("active", true).order("name"),
    ]);
    if (staff.error || departments.error) return failure(staff.error ?? departments.error!);
    return result({ people: (staff.data ?? []).map(person => ({...person, roles: Array.isArray(person.roles) ? person.roles[0] ?? null : person.roles})), departments: departments.data ?? [] }, null);
  },
  create: (actorId: string, input: { code: string; name: string; description?: string | null; hostDepartmentId: string; leadIds: string[] }) => rpc<Project>("api_create_project", { p_actor_id: actorId, p_code: input.code, p_name: input.name, p_description: input.description ?? null, p_host_department_id: input.hostDepartmentId, p_lead_ids: input.leadIds }),
  update: (actorId: string, projectId: string, input: { code: string; name: string; description?: string | null; hostDepartmentId: string }) => rpc<Project>("api_update_project", { p_actor_id: actorId, p_project_id: projectId, p_code: input.code, p_name: input.name, p_description: input.description ?? null, p_host_department_id: input.hostDepartmentId }),
  setMember: (actorId: string, projectId: string, userId: string, role: "lead" | "deputy" | "member" | null, remove = role === null) => rpc<ProjectMember | null>("api_set_project_member", { p_actor_id: actorId, p_project_id: projectId, p_user_id: userId, p_role: role, p_remove: remove }),
  close: (actorId: string, projectId: string) => rpc<Project>("api_close_project", { p_actor_id: actorId, p_project_id: projectId }),
  reopen: (actorId: string, projectId: string) => rpc<Project>("api_reopen_project", { p_actor_id: actorId, p_project_id: projectId }),
  transferLead: (actorId: string, projectId: string, userId: string, ownRole: "lead" | "deputy" | "member") => rpc<unknown>("api_transfer_project_lead", { p_actor_id: actorId, p_project_id: projectId, p_new_lead_id: userId, p_actor_role: ownRole }),
  assignTask: (actorId: string, projectId: string, input: ProjectAssignmentInput) => rpc<{ id: string }>("api_assign_project_task", { p_actor_id: actorId, p_project_id: projectId, p_title: input.title, p_description: input.description, p_assignee_id: input.assigneeId, p_reviewer_id: input.reviewerId ?? null, p_due_date: input.dueDate, p_due_time: input.dueTime, p_evaluation_criteria: input.evaluationCriteria ?? null, p_collaborator_ids: input.collaboratorIds ?? [], p_watcher_ids: input.watcherIds ?? [], p_priority: input.priority ?? "normal", p_attachment_url: input.attachmentUrl ?? null }),
  deleteCancelledTasks: (actorId: string, projectId: string, taskIds: string[]) => rpc<{ deleted: number; storage_paths: string[] }>("api_delete_cancelled_project_tasks", { p_actor_id: actorId, p_project_id: projectId, p_task_ids: taskIds }),
  async list(actor: ProjectReader): Promise<Result<Project[]>> {
    let query = serverSupabase.from("projects").select(PROJECT_FIELDS).order("created_at", { ascending: false });
    if (!canReadAll(actor)) {
      const membership = await serverSupabase.from("project_members").select("project_id,staff_users!project_members_user_id_fkey!inner(active)").eq("user_id", actor.id).eq("staff_users.active", true);
      if (membership.error) return failure(membership.error);
      const ids = (membership.data ?? []).map((row) => row.project_id as string);
      if (!ids.length) return result([], null);
      query = query.in("id", ids);
    }
    const q = await query;
    return result((q.data ?? []).map(row => ({ ...row, host_department: Array.isArray(row.host_department) ? row.host_department[0] ?? null : row.host_department })) as Project[], q.error);
  },
  async get(actor: ProjectReader, projectId: string): Promise<Result<Project | null>> {
    const access = await readAccess(actor, projectId);
    if (!access.ok) return access;
    const q = await serverSupabase.from("projects").select(PROJECT_FIELDS).eq("id", projectId).maybeSingle();
    return result(q.data as Project | null, q.error);
  },
  async listMembers(actor: ProjectReader, projectId: string): Promise<Result<ProjectMember[]>> {
    const access = await readAccess(actor, projectId);
    if (!access.ok) return access;
    const q = await serverSupabase.from("project_members").select("project_id,user_id,role,added_by,added_at,staff_users!project_members_user_id_fkey(id,full_name,active,roles(code))").eq("project_id", projectId);
    return result((q.data ?? []) as unknown as ProjectMember[], q.error);
  },
  async listTasks(actor: ProjectReader, projectId: string, filters: { status?: string; assigneeId?: string } = {}): Promise<Result<ProjectTask[]>> {
    const access = await readAccess(actor, projectId);
    if (!access.ok) return access;
    let query = serverSupabase.from("tasks").select("id,project_id,title,status,assignee_id,reviewer_id,due_date,due_time,completion_submitted_at,completed_at,priority,created_by,created_at,created_by_user:staff_users!tasks_created_by_fkey(full_name),task_assignees(user_id,assignment_role)").eq("project_id", projectId).order("created_at", { ascending: false });
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.assigneeId) query = query.eq("assignee_id", filters.assigneeId);
    const q = await query;
    return result((q.data ?? []).map(row => {
      const { task_assignees, ...task } = row;
      return { ...task, collaborator_ids: (task_assignees ?? []).filter(person => person.assignment_role === "assignee" && person.user_id !== row.assignee_id).map(person => person.user_id) };
    }) as ProjectTask[], q.error);
  },
};
