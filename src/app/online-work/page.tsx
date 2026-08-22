import {redirect} from "next/navigation";import {getSessionUser} from "@/lib/serverSession";import OnlineWorkViewer from "@/components/OnlineWorkViewer";
export default async function Page(){const user=await getSessionUser();if(!user)redirect("/login");return <OnlineWorkViewer userLabel={user.full_name} initialView={user.preferences.defaultScheduleView}/>;}
