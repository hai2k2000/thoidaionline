import { departmentPlanHandlers } from "@/lib/departmentPlanHandlers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Context = { params: Promise<{ itemId: string }> };

export async function POST(request: Request, context: Context) {
  return departmentPlanHandlers.quickAssignTask(request, (await context.params).itemId);
}
