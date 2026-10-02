import { departmentPlanHandlers } from "@/lib/departmentPlanHandlers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Context = { params: Promise<{ planId: string }> };

export async function POST(request: Request, context: Context) {
  return departmentPlanHandlers.createAndAssignItem(request, (await context.params).planId);
}
