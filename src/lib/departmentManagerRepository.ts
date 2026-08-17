import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";

export type DepartmentManagerDepartment = {
  id: string;
  code: string;
  name: string;
  manager_id: string | null;
};

export type DepartmentManagerCandidate = {
  id: string;
  full_name: string;
  department_id: string;
};

export type DepartmentManagerData = {
  departments: DepartmentManagerDepartment[];
  candidates: DepartmentManagerCandidate[];
  failed: boolean;
};

export const departmentManagerRepository = {
  async list(): Promise<DepartmentManagerData> {
    const [departmentResult, candidateResult] = await Promise.all([
      serverSupabase
        .from("departments")
        .select("id,code,name,manager_id")
        .eq("active", true)
        .order("code"),
      serverSupabase
        .from("staff_users")
        .select("id,full_name,department_id")
        .eq("active", true)
        .not("department_id", "is", null)
        .order("full_name"),
    ]);

    return {
      departments: (departmentResult.data ?? []) as DepartmentManagerDepartment[],
      candidates: (candidateResult.data ?? []) as DepartmentManagerCandidate[],
      failed: Boolean(departmentResult.error || candidateResult.error),
    };
  },

  setManager(actorId: string, departmentId: string, managerId: string) {
    return serverSupabase.rpc("api_set_department_manager", {
      p_actor: actorId,
      p_department: departmentId,
      p_manager: managerId,
    });
  },
};
