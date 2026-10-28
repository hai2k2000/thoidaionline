import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";
import { resolveAttendanceAccess } from "@/lib/attendanceAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AttendanceLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!(await resolveAttendanceAccess(user)).orgScope) redirect("/my-attendance");
  return children;
}
