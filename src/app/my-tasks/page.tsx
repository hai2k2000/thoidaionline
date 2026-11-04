import { getSessionUser } from "@/lib/serverSession";
import { isCollaboratorRole } from "@/lib/collaboratorRole.mjs";
import { TasksPage } from "../tasks/page";
import { redirect } from "next/navigation";
import {
  buildLegacyTaskRedirectFromParams,
  type LegacySearchParams,
} from "@/components/phase2Navigation";

type LegacyRedirectPageProps = {
  searchParams: Promise<LegacySearchParams>;
};

export default async function LegacyRedirectPage({
  searchParams,
}: LegacyRedirectPageProps) {
  const user = await getSessionUser();
  if ((await searchParams).scope === "collaborating") return <TasksPage searchParams={searchParams} basePath="/my-tasks" />;
  if (user && isCollaboratorRole(user.role_code)) return <TasksPage searchParams={searchParams} basePath="/my-tasks" />;
  redirect(buildLegacyTaskRedirectFromParams("/my-tasks", await searchParams));
}
