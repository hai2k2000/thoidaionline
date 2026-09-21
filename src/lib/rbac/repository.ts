import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";
import type { RbacActor, RbacGrant, RbacScope } from "./types";

type GrantRow = { permission_code: string; scope: RbacScope };

export async function loadRbacActor(actor: { id: string; department_id: string | null }): Promise<RbacActor> {
  const { data, error } = await serverSupabase.rpc("api_list_role_permission_grants", { p_actor_id: actor.id });
  if (error) throw error;
  const grants = ((data ?? []) as GrantRow[]).map((row): RbacGrant => ({
    permissionCode: row.permission_code,
    scope: row.scope,
  }));
  return { id: actor.id, departmentId: actor.department_id, grants };
}

export function createRbacRequestContext() {
  const actors = new Map<string, Promise<RbacActor>>();
  return {
    load(actor: { id: string; department_id: string | null }) {
      const cached = actors.get(actor.id);
      if (cached) return cached;
      const pending = loadRbacActor(actor);
      actors.set(actor.id, pending);
      return pending;
    },
  };
}
