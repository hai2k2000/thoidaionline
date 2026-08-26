import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";
import { workScheduleRepository } from "@/lib/workScheduleRepository";
import WorkSchedulePageShell from "@/components/WorkSchedulePageShell";
export default async function Page(){const user=await getSessionUser();if(!user)redirect("/login");const result=await workScheduleRepository.allPeople();if(!result.ok)throw new Error("Không tải được nhân sự.");const people=(result.people as never[]).filter((p:any)=>["tong_bien_tap","pho_tong_bien_tap","truong_phong"].includes(p.roles?.code)||p.job_titles?.code?.startsWith("truong_phong"));return <WorkSchedulePageShell userLabel={user.full_name} people={people as never}/>;}

