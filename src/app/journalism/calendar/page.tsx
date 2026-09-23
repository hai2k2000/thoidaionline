import { redirect } from "next/navigation";
import JournalismCalendarShell from "@/components/JournalismCalendarShell";
import { getSessionUser } from "@/lib/serverSession";
import { parseCalendarQuery } from "@/lib/journalismCalendar";
import { loadJournalismCalendar } from "@/lib/journalismCalendarRepository";
import { canUseJournalism } from "@/lib/journalismScope.mjs";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
export default async function JournalismCalendarPage({ searchParams }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canUseJournalism({ roleCode: user.role_code, departmentCode: user.department_code, rbacPermissions: user.rbacPermissions })) redirect("/tasks");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) params.set(key, Array.isArray(value) ? value[0] ?? "" : value ?? "");
  const query = parseCalendarQuery(params);
  const result = await loadJournalismCalendar({ id: user.id, departmentId: user.department_id, departmentCode: user.department_code, roleCode: user.role_code, roleLevel: user.role_level, permissions: user.permissions, rbacPermissions: user.rbacPermissions }, query);
  if (!result.ok) return <p className="p-6 text-red-700">Không thể tải lịch biên tập.</p>;
  return <JournalismCalendarShell userLabel={user.full_name} query={query} data={result.data} />;
}
