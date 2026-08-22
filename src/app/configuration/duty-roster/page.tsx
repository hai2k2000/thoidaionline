import { redirect } from "next/navigation";
import DutyTaskShell from "@/components/DutyTaskShell";
import { dutyTaskRepository } from "@/lib/dutyTaskRepository";
import { getSessionUser } from "@/lib/serverSession";
export default async function DutyRosterConfigurationPage() { const user = await getSessionUser(); if (!user) redirect("/login"); if (user.role_code !== "admin") redirect("/duty-schedule"); const options = await dutyTaskRepository.options(); if (!options.ok) throw new Error("Không tải được danh sách nhân sự."); return <DutyTaskShell userLabel={user.full_name} {...options} />; }
