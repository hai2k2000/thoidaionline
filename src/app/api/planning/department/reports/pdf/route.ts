import { departmentPlanPdfHandler } from "@/lib/departmentPlanPdfHandler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = departmentPlanPdfHandler;

