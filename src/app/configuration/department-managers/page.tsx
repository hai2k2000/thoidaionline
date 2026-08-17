import { redirect } from "next/navigation";
import DepartmentManagerShell from "@/components/DepartmentManagerShell";
import { departmentManagerRepository } from "@/lib/departmentManagerRepository";
import { getSessionUser } from "@/lib/serverSession";

export default async function DepartmentManagersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (
    user.role_code !== "admin" ||
    !user.permissions.can_manage_users
  ) redirect("/tasks");

  const data = await departmentManagerRepository.list();
  return <DepartmentManagerShell userLabel={user.full_name} {...data} />;
}
