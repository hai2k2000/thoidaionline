import { getSessionUser } from "@/lib/serverSession";
import { isCollaboratorRole } from "@/lib/collaboratorRole.mjs";
import { TasksPage } from "../tasks/page";
import type { LegacySearchParams } from "@/components/phase2Navigation";

type LegacyRedirectPageProps = {
  searchParams: Promise<LegacySearchParams>;
};

export default async function LegacyRedirectPage({
  searchParams,
}: LegacyRedirectPageProps) {
  const user = await getSessionUser();
  if (["collaborating", "department_collaborating"].includes(String((await searchParams).scope))) return <TasksPage searchParams={searchParams} basePath="/my-tasks" />;
  if (user && isCollaboratorRole(user.role_code)) return <TasksPage searchParams={searchParams} basePath="/my-tasks" />;
  const params = await searchParams;
  const hasExplicitTypeOrScope = params.type !== undefined || params.scope !== undefined;
  return <TasksPage searchParams={Promise.resolve(hasExplicitTypeOrScope ? params : { ...params, scope: "mine" })} basePath="/my-tasks" />;
}
