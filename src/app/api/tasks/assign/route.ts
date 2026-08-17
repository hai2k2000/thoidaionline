import { taskHandlers } from "@/lib/taskHandlers";

export async function POST(request: Request) {
  return taskHandlers.assign(request);
}
