import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";
import { workScheduleRepository } from "@/lib/workScheduleRepository";
import WorkSchedulePageShell from "@/components/WorkSchedulePageShell";
export default async function Page(){const user=await getSessionUser();if(!user)redirect("/login");if(user.role_code!=="admin"&&user.role_code!=="tong_bien_tap"&&user.role_code!=="pho_tong_bien_tap"&&!user.is_department_manager)redirect("/work-schedule/staff");const result=await workScheduleRepository.allPeople();if(!result.ok)throw new Error("Không tải được nhân sự.");return <WorkSchedulePageShell userLabel={user.full_name} people={result.people as never}/>;}
