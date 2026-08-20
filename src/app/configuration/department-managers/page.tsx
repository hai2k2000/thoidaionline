import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/serverSession";

export default async function DepartmentManagersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(user.role_code === "admin" ? "/users" : "/tasks");
}
