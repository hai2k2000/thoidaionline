import { evaluationHandlers } from "@/lib/evaluationHandlers";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return evaluationHandlers.submit(request, (await context.params).id);
}
