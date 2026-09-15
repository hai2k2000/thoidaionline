import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";
import { workScheduleRepository } from "@/lib/workScheduleRepository";
import WorkSchedulePageShell from "@/components/WorkSchedulePageShell";
export default async function Page(){const user=await getSessionUser();if(!user)redirect("/login");const result=await workScheduleRepository.allPeople();if(!result.ok)throw new Error("Không tải được nhân sự.");return <WorkSchedulePageShell currentUserId={user.id} userLabel={user.full_name} people={result.people as never} scheduleScope="all" title="Kế hoạch cá nhân" description="Lịch làm việc, công tác và sự kiện của toàn cơ quan. Mọi tài khoản đã đăng nhập đều có thể xem."/>;}

