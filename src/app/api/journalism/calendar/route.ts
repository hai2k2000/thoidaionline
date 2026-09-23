import { apiError, apiJson, requireReadActor } from "@/lib/serverApi";
import { parseCalendarQuery } from "@/lib/journalismCalendar";
import { loadJournalismCalendar } from "@/lib/journalismCalendarRepository";
import { canUseJournalism } from "@/lib/journalismScope.mjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const guard = await requireReadActor();
  if (!guard.ok) return guard.response;
  const user = guard.actor;
  if (user.department_code !== "editorial" || !canUseJournalism({
    roleCode: user.role_code,
    departmentCode: user.department_code,
    rbacPermissions: user.rbacPermissions,
  })) return apiError("forbidden", 403);
  const query = parseCalendarQuery(new URL(request.url).searchParams);
  const result = await loadJournalismCalendar({
    id: user.id,
    departmentId: user.department_id,
    departmentCode: user.department_code,
    roleCode: user.role_code,
    roleLevel: user.role_level,
    permissions: user.permissions,
    rbacPermissions: user.rbacPermissions,
  }, query);
  return result.ok ? apiJson({ calendar: result.data }) : apiError("operation_failed", 500);
}
