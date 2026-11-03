import "server-only";
import type { ServerAuthUser } from "@/lib/serverSession";
import { projectRepository } from "@/lib/projectRepository";
import { apiError, rpcFailure } from "@/lib/serverApi";

export const isProjectCreator = (user: Pick<ServerAuthUser, "rbacPermissionScopes">) =>
  Boolean(user.rbacPermissionScopes["project.create"]?.length);
export const projectReader = (user: ServerAuthUser) => ({ id: user.id, roleCode: user.role_code });

export async function requireProjectLead(user: ServerAuthUser, id: string): Promise<Response | null> {
  const result = await projectRepository.listMembers(projectReader(user), id);
  if (!result.ok) return rpcFailure(result.error);
  return result.data.some((member) => member.user_id === user.id && member.role === "lead" && member.staff_users?.active)
    ? null : apiError("forbidden", 403);
}
