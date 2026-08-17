import { taskHandlers } from "@/lib/taskHandlers";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  return taskHandlers.changePersonalDeadline(request, (await context.params).id);
}
