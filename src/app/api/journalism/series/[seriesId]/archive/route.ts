import { journalismStructureHandlers } from "@/lib/journalismStructureHandlers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request, context: { params: Promise<{ seriesId: string }> }) {
  return journalismStructureHandlers.archiveSeries(request, (await context.params).seriesId);
}
