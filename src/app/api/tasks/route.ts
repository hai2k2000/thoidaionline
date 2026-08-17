import { taskHandlers } from "@/lib/taskHandlers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = taskHandlers.list;
export const POST = taskHandlers.create;
