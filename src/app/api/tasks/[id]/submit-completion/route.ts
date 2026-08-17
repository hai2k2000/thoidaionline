import { taskHandlers } from "@/lib/taskHandlers";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  return taskHandlers.submitAssignedCompletion(request, (await context.params).id);
}
