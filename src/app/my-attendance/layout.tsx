import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MyAttendanceLayout({ children }: { children: React.ReactNode }) {
  if (!(await getSessionUser())) redirect("/login");
  return children;
}
