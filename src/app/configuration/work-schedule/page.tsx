import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";
import { workScheduleRepository } from "@/lib/workScheduleRepository";
import WorkScheduleAdminShell from "@/components/WorkScheduleAdminShell";
export default async function Page(){const user=await getSessionUser();if(!user)redirect("/login");if(user.role_code!=="admin")redirect("/tasks");const result=await workScheduleRepository.people();if(!result.ok)throw new Error("Không tải được nhân sự.");return <WorkScheduleAdminShell userLabel={user.full_name} people={result.people as {id:string;full_name:string}[]}/>;}
