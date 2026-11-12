import { taskHandlers } from "@/lib/taskHandlers";
type Context = { params: Promise<{ id: string; linkId: string }> };
export async function DELETE(request: Request, context: Context) {
  const { id, linkId } = await context.params;
  return taskHandlers.deleteLink(request, id, linkId);
}
