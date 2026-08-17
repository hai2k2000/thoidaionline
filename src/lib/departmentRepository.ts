import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";

export type DepartmentRow = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

const fields = "id,code,name,active";

export const departmentRepository = {
  list() {
    return serverSupabase
      .from("departments")
      .select(fields)
      .order("name");
  },

  create(code: string, name: string) {
    return serverSupabase
      .from("departments")
      .insert({ code, name, active: true })
      .select(fields)
      .single();
  },

  update(id: string, patch: { name?: string; active?: boolean }) {
    return serverSupabase
      .from("departments")
      .update(patch)
      .eq("id", id)
      .select(fields)
      .maybeSingle();
  },
};
