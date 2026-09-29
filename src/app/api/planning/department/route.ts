import { departmentPlanHandlers } from "@/lib/departmentPlanHandlers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const GET = departmentPlanHandlers.list;
export const POST = departmentPlanHandlers.createPlan;
