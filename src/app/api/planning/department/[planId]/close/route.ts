import { departmentPlanHandlers } from "@/lib/departmentPlanHandlers";
export const dynamic = "force-dynamic";
export const POST = (request: Request, context: { params: Promise<{ planId: string }> }) => context.params.then(({ planId }) => departmentPlanHandlers.closePlan(request, planId));