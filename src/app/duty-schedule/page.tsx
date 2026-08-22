import { redirect } from "next/navigation";
import DutyScheduleViewer from "@/components/DutyScheduleViewer";
import { getSessionUser } from "@/lib/serverSession";
export default async function DutySchedulePage() { const user = await getSessionUser(); if (!user) redirect("/login"); return <DutyScheduleViewer userLabel={user.full_name} />; }
