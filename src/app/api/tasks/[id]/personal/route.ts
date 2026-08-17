import { taskHandlers } from "@/lib/taskHandlers";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  return taskHandlers.editPersonal(request, (await context.params).id);
}
