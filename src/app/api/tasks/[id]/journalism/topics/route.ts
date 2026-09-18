import { journalismAssociationHandlers } from "@/lib/journalismAssociationHandlers";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return journalismAssociationHandlers.attachTopic(request, (await context.params).id);
}
