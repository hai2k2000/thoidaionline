import { taskHandlers } from "@/lib/taskHandlers";
type Context = { params: Promise<{ id: string; attachmentId: string }> };
export async function GET(request: Request, context: Context) {
  const { id, attachmentId } = await context.params;
  return taskHandlers.downloadAttachment(id, attachmentId, request);
}
export async function DELETE(request: Request, context: Context) {
  const { id, attachmentId } = await context.params;
  return taskHandlers.deleteAttachment(request, id, attachmentId);
}
