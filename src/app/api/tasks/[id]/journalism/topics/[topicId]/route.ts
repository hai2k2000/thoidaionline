import { journalismAssociationHandlers } from "@/lib/journalismAssociationHandlers";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string; topicId: string }> }) {
  const params = await context.params;
  return journalismAssociationHandlers.detachTopic(request, params.id, params.topicId);
}
