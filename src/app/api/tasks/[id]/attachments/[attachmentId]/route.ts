import { taskHandlers } from "@/lib/taskHandlers";
type Context = { params: Promise<{ id: string; attachmentId: string }> };
export async function GET(_request: Request, context: Context) {
  const { id, attachmentId } = await context.params;
  return taskHandlers.downloadAttachment(id, attachmentId);
}
