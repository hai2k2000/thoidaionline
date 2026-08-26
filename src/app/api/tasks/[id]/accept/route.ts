import { taskHandlers } from "@/lib/taskHandlers";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return taskHandlers.acceptAssignedTask(request, (await context.params).id);
}
