import { redirect } from "next/navigation";
import {
  buildLegacyTaskRedirectFromParams,
  type LegacySearchParams,
} from "@/components/phase2Navigation";
import { getSessionUser } from "@/lib/serverSession";
import { isCollaboratorRole } from "@/lib/collaboratorRole.mjs";
import DeskHome from "@/components/DeskHome";
import { loadDeskData } from "@/lib/deskRepository";
import { deskGreeting, deskGreetingPeriod, deskDateLabel } from "@/lib/deskHome.mjs";

type LegacyRedirectPageProps = {
  searchParams: Promise<LegacySearchParams>;
};

export default async function LegacyRedirectPage({
  searchParams,
}: LegacyRedirectPageProps) {
  const params = await searchParams;
  if (Object.keys(params).length) redirect(buildLegacyTaskRedirectFromParams("/", params));
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isCollaboratorRole(user.role_code)) redirect("/my-tasks");
  const now = new Date();
  return <DeskHome fullName={user.full_name} avatarUrl={user.avatar_url} greeting={deskGreeting(user.full_name, now)} greetingPeriod={deskGreetingPeriod(now)} dateLabel={deskDateLabel(now)} data={await loadDeskData(user)} />;
}
