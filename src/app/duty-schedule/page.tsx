import { redirect } from "next/navigation";
import DutyScheduleViewer from "@/components/DutyScheduleViewer";
import { getSessionUser } from "@/lib/serverSession";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DutySchedulePage({ searchParams }: Props) {
  const user = await getSessionUser(); if (!user) redirect("/login");
  const raw = await searchParams;
  return <DutyScheduleViewer userLabel={user.full_name} initialView={user.preferences.defaultScheduleView} initialScope={raw.scope === "personal" ? "personal" : "organization"} />;
}
