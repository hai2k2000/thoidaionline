import "server-only";

import type { AuthorizationActor } from "@/lib/authorization";
import { serverSupabase } from "@/lib/serverSupabase";

export type AssignmentDepartment = { id: string; name: string; managerId: string | null; hasManager: boolean };
export type AssignmentPerson = { id: string; fullName: string; departmentId: string | null; canReview: boolean };

export const taskAssignmentRepository = {
  async options(actor: AuthorizationActor) {
    const broad = actor.roleCode === "admin" || actor.roleCode === "pho_tong_bien_tap";
    let departmentsQuery = serverSupabase.from("departments")
      .select("id,name,manager_id").eq("active", true).order("name");
    let peopleQuery = serverSupabase.from("staff_users")
      .select("id,full_name,department_id,roles(code)").eq("active", true).order("full_name");
    if (!broad && actor.departmentId) {
      departmentsQuery = departmentsQuery.eq("id", actor.departmentId);
      peopleQuery = peopleQuery.eq("department_id", actor.departmentId);
    }
    const [departments, people] = await Promise.all([departmentsQuery, peopleQuery]);
    if (departments.error || people.error) return { ok: false as const };
    return {
      ok: true as const,
      departments: (departments.data ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        managerId: row.manager_id as string | null,
        hasManager: row.manager_id !== null,
      })),
      people: (people.data ?? []).map((row) => ({
        id: row.id as string,
        fullName: row.full_name as string,
        departmentId: row.department_id as string | null,
        canReview: [
          "phu_trach_phong_tri_su", "phu_trach_phong_phong_vien",
          "phu_trach_phong_bien_tap", "pho_tong_bien_tap", "tong_bien_tap",
        ].includes((row.roles as unknown as { code?: string } | null)?.code ?? ""),
      })),
    };
  },
};
