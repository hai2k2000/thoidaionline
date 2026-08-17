import { runTaskRecurrence } from "@/lib/recurrenceRunner";

export async function POST(request: Request) {
  return runTaskRecurrence(request);
}
