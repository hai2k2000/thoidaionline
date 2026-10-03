import { loadWorkReport } from "@/lib/workReportService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const result = await loadWorkReport(request);
  return result.ok
    ? Response.json(result.data, { headers: { "Cache-Control": "private, no-store" } })
    : result.response;
}
