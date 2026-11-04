import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";
import { workScheduleRepository } from "@/lib/workScheduleRepository";
import WorkSchedulePageShell from "@/components/WorkSchedulePageShell";
import { canReviewAnyPersonalPlan, getApprovalCapabilities } from "@/lib/rbac/approval";
import { canAssignEvents as canManageEvents, eventAssignmentPeople } from "@/lib/workScheduleEventAccess";
export default async function Page({ searchParams }: { searchParams?: Promise<{ eventAssignment?: string }> }){const user=await getSessionUser();if(!user)redirect("/login");const result=await workScheduleRepository.allPeople();if(!result.ok)throw new Error("Không tải được nhân sự.");let canReviewPersonalPlans=false;try{canReviewPersonalPlans=canReviewAnyPersonalPlan(await getApprovalCapabilities(user.id));}catch{}const canAssignEvents = canManageEvents(user);const eventPeople = eventAssignmentPeople(result.people as never, user);const params=await searchParams;return <WorkSchedulePageShell currentUserId={user.id} currentUserRole={user.role_code} approvalActorId={user.id} canReviewPersonalPlans={canReviewPersonalPlans} userLabel={user.full_name} people={result.people as never} scheduleScope="self" title="Kế hoạch cá nhân" description="Lịch làm việc, công tác và sự kiện của bạn." enableEventAssignment={canAssignEvents} eventAssignmentOpen={params?.eventAssignment === "1"} eventPeople={canAssignEvents ? eventPeople as never : undefined}/>;}

