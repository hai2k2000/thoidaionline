import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";
import { loadJournalismSeriesOrder } from "@/lib/journalismStructureRepository";
import JournalismSeriesOrderShell from "@/components/JournalismSeriesOrderShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function JournalismSeriesOrderPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const data = await loadJournalismSeriesOrder(user, (await params).seriesId);
  if (!data) notFound();
  return <JournalismSeriesOrderShell userLabel={user.full_name} series={data.series} items={data.items} hasHiddenItems={data.hasHiddenItems} canManage={data.canManage} />;
}
