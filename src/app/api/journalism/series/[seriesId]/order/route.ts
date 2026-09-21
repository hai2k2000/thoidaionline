import { journalismAssociationHandlers } from "@/lib/journalismAssociationHandlers";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ seriesId: string }> }) {
  return journalismAssociationHandlers.reorderSeries(request, (await context.params).seriesId);
}
