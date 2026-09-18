import { journalismAssociationHandlers } from "@/lib/journalismAssociationHandlers";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return journalismAssociationHandlers.attachSeries(request, (await context.params).id);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return journalismAssociationHandlers.detachSeries(request, (await context.params).id);
}
