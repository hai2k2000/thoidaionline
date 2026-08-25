import "server-only";

import type { AuthorizationActor } from "@/lib/authorization";
import { serverSupabase } from "@/lib/serverSupabase";
import { resolveAssignmentSelection } from "@/lib/taskAssignmentGroup";
import { isEligibleAssignmentReviewer, isLeadershipAssignmentReviewer } from "@/lib/taskReviewerPolicy.mjs";

export type AssignmentDepartment = { id: string; code?: string | null; name: string; managerId: string | null; hasManager: boolean };
export type AssignmentPerson = { id: string; fullName: string; departmentId: string | null; roleCode: string | null; canReview: boolean; canReviewOutsideDepartment: boolean };

export const taskAssignmentRepository = {
  async options(actor: AuthorizationActor) {
    const broad = ["admin", "tong_bien_tap", "pho_tong_bien_tap"].includes(actor.roleCode);
    let departmentsQuery = serverSupabase.from("departments")
      .select("id,code,name,manager_id").eq("active", true).order("name");
    const peopleQuery = serverSupabase.from("staff_users")
      .select("id,full_name,department_id,job_titles(code),roles(code)").eq("active", true).order("full_name");
    if (!broad && actor.departmentId) {
      departmentsQuery = departmentsQuery.eq("id", actor.departmentId);
    }
    const [departments, people] = await Promise.all([departmentsQuery, peopleQuery]);
    if (departments.error || people.error) return { ok: false as const };
    const managerIds = new Set((departments.data ?? []).map((row) => row.manager_id).filter(Boolean));
    const leadershipDepartment = (departments.data ?? []).find((row) => row.code === "leadership");
    const normalizePersonDepartment = (row: (typeof people.data)[number]) => leadershipDepartment && leadershipDepartment.id === (departments.data ?? []).find((department) => department.code === "leadership")?.id && ((row.roles as unknown as { code?: string } | null)?.code === "pho_tong_bien_tap" || (row.job_titles as unknown as { code?: string } | null)?.code === "truong_phong") ? leadershipDepartment.id as string : row.department_id as string | null;
    return {
      ok: true as const,
      departments: (departments.data ?? []).map((row) => ({
        id: row.id as string,
        code: row.code as string | null,
        name: row.name as string,
        managerId: row.manager_id as string | null,
        hasManager: row.manager_id !== null,
      })),
      people: (people.data ?? []).filter((row) => (actor.roleCode !== "pho_tong_bien_tap" || (row.roles as unknown as { code?: string } | null)?.code !== "tong_bien_tap") && (broad || row.department_id === actor.departmentId || isLeadershipAssignmentReviewer(
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
