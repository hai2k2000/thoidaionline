import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/rbac/authorization";
import { loadRbacActor } from "@/lib/rbac/repository";
import { getSessionUser } from "@/lib/serverSession";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PermissionsLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  try {
    const actor = await loadRbacActor(user);
    if (!hasPermission(actor, "permission.manage")) redirect("/");
  } catch {
    redirect("/");
  }
  return children;
}
