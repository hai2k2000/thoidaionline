import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";
import { workScheduleRepository } from "@/lib/workScheduleRepository";
import WorkSchedulePageShell from "@/components/WorkSchedulePageShell";
export default async function Page(){const user=await getSessionUser();if(!user)redirect("/login");const result=await workScheduleRepository.person(user.id);if(!result.ok)throw new Error("Không tải được nhân sự.");const people=result.person?[result.person]:[];return <WorkSchedulePageShell userLabel={user.full_name} people={people as never} scheduleScope="self" title="Kế hoạch nhân viên" description="Chỉ hiển thị kế hoạch làm việc của chính bạn."/>;}

