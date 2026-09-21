import { journalismStructureHandlers } from "@/lib/journalismStructureHandlers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  return journalismStructureHandlers.createSeries(request);
}
