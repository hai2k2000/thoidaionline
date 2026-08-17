import { taskHandlers } from "@/lib/taskHandlers";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  return taskHandlers.cancelAssigned(request, (await context.params).id);
}
