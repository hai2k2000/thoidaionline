import { taskHandlers } from "@/lib/taskHandlers";

type Context = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: Request, context: Context) {
  return taskHandlers.detail((await context.params).id);
}

export async function PATCH(request: Request, context: Context) {
  return taskHandlers.update(request, (await context.params).id);
}
