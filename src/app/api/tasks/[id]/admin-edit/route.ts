import { taskHandlers } from "@/lib/taskHandlers";
type Context={params:Promise<{id:string}>};
export const dynamic="force-dynamic";
export async function PATCH(request:Request,context:Context){return taskHandlers.adminEditTask(request,(await context.params).id);}
