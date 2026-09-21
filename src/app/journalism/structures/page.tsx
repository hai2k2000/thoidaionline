import { redirect } from "next/navigation";
import JournalismStructuresShell from "@/components/JournalismStructuresShell";
import { getSessionUser } from "@/lib/serverSession";
import { canManageStructures, loadJournalismStructurePage } from "@/lib/journalismStructureRepository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function JournalismStructuresPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!(await canManageStructures(user))) redirect("/tasks");
  const data = await loadJournalismStructurePage(user);
  if (!data) redirect("/tasks");
  return <JournalismStructuresShell data={data} userLabel={user.full_name} />;
}
