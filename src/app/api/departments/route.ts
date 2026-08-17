import { departmentHandlers } from "@/lib/departmentHandlers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const GET = departmentHandlers.list;
export const POST = departmentHandlers.create;
export const PATCH = departmentHandlers.update;
