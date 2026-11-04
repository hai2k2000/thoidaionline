import "server-only";

import type { AuthorizationActor } from "@/lib/authorization";
import { serverSupabase } from "@/lib/serverSupabase";
import { resolveAssignmentSelection } from "@/lib/taskAssignmentGroup";
import { isSystemAdminStaff, sortStaffRows } from "@/lib/staffOrdering";
import { isEligibleAssignmentReviewer, isLeadershipAssignmentReviewer } from "@/lib/taskReviewerPolicy.mjs";
import { deriveAssignmentScope } from "@/lib/taskAssignmentScope.mjs";
import { normalizePermissions } from "@/lib/permissions";
import { canAccessTaskAssignment } from "@/lib/taskAssignAccess";

export type AssignmentDepartment = { id: string; code?: string | null; name: string; managerId: string | null; hasManager: boolean };
export type AssignmentPerson = { id: string; fullName: string; departmentId: string | null; roleCode: string | null; canReview: boolean; canReviewOutsideDepartment: boolean };
export type AssignmentScope = { kind: "own_department" | "global_default"; departmentId: string | null; departmentName: string | null; canChooseOtherDepartment: boolean };

export const taskAssignmentRepository = {
  async assigners() {
    const [users, departments, permissions] = await Promise.all([
      serverSupabase.from("staff_users").select("id,full_name,department_id,role_id,roles(code,name,level,active),job_titles(code,name,active)").eq("active", true).order("full_name"),
      serverSupabase.from("departments").select("id,name,manager_id").eq("active", true),
      serverSupabase.from("role_permissions").select("*"),
    ]);
    if (users.error || departments.error || permissions.error) return null;
    return (users.data ?? []).flatMap((row) => {
      const role = row.roles as unknown as { code: string; name: string; level: number; active: boolean } | null;
      const job = row.job_titles as unknown as { code: string; name: string; active: boolean } | null;
      const department = departments.data.find((item) => item.id === row.department_id);
      const permission = normalizePermissions(permissions.data.find((item) => item.role_id === row.role_id));
      if (!role?.active || role.code === "admin" || !isEligibleAssignmentReviewer({ roleCode: role.code, jobTitleCode: job?.active ? job.code : null, isDepartmentManager: departments.data.some((item) => item.manager_id === row.id) })
        || !canAccessTaskAssignment({ role_code: role.code, can_assign_task: permission.can_assign_task })) return [];
      return [{ id: row.id as string, fullName: row.full_name as string, label: `${row.full_name} — ${job?.active ? job.name : role.name} (${department?.name ?? "Chưa có phòng"})`, actor: { id: row.id as string, departmentId: row.department_id as string | null, roleCode: role.code, roleLevel: role.level, permissions: permission } }];
    });
  },
  async assigner(id: string): Promise<AuthorizationActor | null> {
    return (await this.assigners())?.find((person) => person.id === id)?.actor ?? null;
  },
  async options(actor: AuthorizationActor) {
    const broad = ["admin", "tong_bien_tap", "pho_tong_bien_tap"].includes(actor.roleCode);
    let departmentsQuery = serverSupabase.from("departments")
      .select("id,code,name,manager_id").eq("active", true).order("name");
    const peopleQuery = serverSupabase.from("staff_users")
      .select("id,username,full_name,department_id,job_titles(code),roles(code)").eq("active", true).order("full_name");
    if (!broad && actor.departmentId) {
      departmentsQuery = departmentsQuery.eq("id", actor.departmentId);
    }
    const [departments, people] = await Promise.all([departmentsQuery, peopleQuery]);
    if (departments.error || people.error) return { ok: false as const };
    const managerIds = new Set((departments.data ?? []).map((row) => row.manager_id).filter(Boolean));
    const leadershipDepartment = (departments.data ?? []).find((row) => row.code === "leadership");
    const normalizePersonDepartment = (row: (typeof people.data)[number]) => leadershipDepartment && leadershipDepartment.id === (departments.data ?? []).find((department) => department.code === "leadership")?.id && ((row.roles as unknown as { code?: string } | null)?.code === "pho_tong_bien_tap" || (row.job_titles as unknown as { code?: string } | null)?.code === "truong_phong") ? leadershipDepartment.id as string : row.department_id as string | null;
    const normalizedDepartments = (departments.data ?? []).map((row) => ({
      id: row.id as string,
      code: row.code as string | null,
      name: row.name as string,
      managerId: row.manager_id as string | null,
      hasManager: row.manager_id !== null,
    }));
    return {
      ok: true as const,
      departments: normalizedDepartments,
      scope: deriveAssignmentScope(actor, normalizedDepartments) as AssignmentScope,
      people: sortStaffRows(people.data ?? []).filter((row) => !isSystemAdminStaff(row) && (actor.roleCode !== "pho_tong_bien_tap" || (row.roles as unknown as { code?: string } | null)?.code !== "tong_bien_tap") && (broad || row.department_id === actor.departmentId || isLeadershipAssignmentReviewer(
        (row.roles as unknown as { code?: string } | null)?.code,
      ))).map((row) => ({
        id: row.id as string,
        fullName: row.full_name as string,
        departmentId: normalizePersonDepartment(row),
        roleCode: (row.roles as unknown as { code?: string } | null)?.code ?? null,
        canReview: isEligibleAssignmentReviewer({
          roleCode: (row.roles as unknown as { code?: string } | null)?.code,
          jobTitleCode: (row.job_titles as unknown as { code?: string } | null)?.code,
          isDepartmentManager: managerIds.has(row.id),
        }),
        canReviewOutsideDepartment: isLeadershipAssignmentReviewer((row.roles as unknown as { code?: string } | null)?.code),
      })),
    };
  },
  async resolveParticipants(actor: AuthorizationActor, input: {
    departmentId: string; assigneeId: string; reviewerId: string;
    collaboratorIds: string[]; watcherIds: string[];
    groupDepartmentId: string | null; excludedMemberIds: string[];
  }) {
    const broad = ["admin", "tong_bien_tap", "pho_tong_bien_tap"].includes(actor.roleCode);
    const peopleQuery = serverSupabase.from("staff_users")
      .select("id,department_id,job_titles(code),roles(code)").eq("active", true).order("id");
    const [department, people, leadership] = await Promise.all([
      serverSupabase.from("departments").select("id,code,manager_id").eq("id", input.departmentId).eq("active", true).maybeSingle(),
      peopleQuery,
      serverSupabase.from("departments").select("id").eq("code", "leadership").eq("active", true).maybeSingle(),
    ]);
    if (department.error || people.error) return { ok: false as const };
    return resolveAssignmentSelection({
      broad,
      actorDepartmentId: actor.departmentId,
      department: department.data ? { id: department.data.id as string, managerId: department.data.manager_id as string | null } : null,
      people: (people.data ?? []).map((row) => ({
        id: row.id as string,
        departmentId: leadership.data?.id === input.departmentId && (((row.roles as unknown as { code?: string } | null)?.code === "pho_tong_bien_tap") || ((row.job_titles as unknown as { code?: string } | null)?.code === "truong_phong")) ? input.departmentId : row.department_id as string | null,
        roleCode: (row.roles as unknown as { code?: string } | null)?.code ?? null,
        canReview: isEligibleAssignmentReviewer({
          roleCode: (row.roles as unknown as { code?: string } | null)?.code,
          jobTitleCode: (row.job_titles as unknown as { code?: string } | null)?.code,
          isDepartmentManager: row.id === department.data?.manager_id,
        }),
        canReviewOutsideDepartment: isLeadershipAssignmentReviewer((row.roles as unknown as { code?: string } | null)?.code),
      })),
      actorRoleCode: actor.roleCode,
      ...input,
    });
  },
};
