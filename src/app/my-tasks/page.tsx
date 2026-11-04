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
  return <TasksPage searchParams={Promise.resolve({ ...params, type: params.type ?? "personal" })} basePath="/my-tasks" />;
}
