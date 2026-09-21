import { journalismStructureHandlers } from "@/lib/journalismStructureHandlers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(request: Request, context: { params: Promise<{ topicId: string }> }) {
  return journalismStructureHandlers.updateTopic(request, (await context.params).topicId);
}
