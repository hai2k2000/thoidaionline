import { departmentPlanHandlers } from "@/lib/departmentPlanHandlers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Context = { params: Promise<{ itemId: string }> };

export async function GET(request: Request, context: Context) {
  return departmentPlanHandlers.getItem(request, (await context.params).itemId);
}

export async function PATCH(request: Request, context: Context) {
  return departmentPlanHandlers.updateItem(request, (await context.params).itemId);
}

export async function POST(request: Request, context: Context) {
  return departmentPlanHandlers.createTask(request, (await context.params).itemId);
}

export async function DELETE(request: Request, context: Context) {
  return departmentPlanHandlers.deleteItem(request, (await context.params).itemId);
}
