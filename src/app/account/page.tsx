import { redirect } from "next/navigation";
import AccountShell from "@/components/AccountShell";
import { getSessionUser } from "@/lib/serverSession";

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <AccountShell userLabel={user.full_name} roleName={user.role_name} email={user.email} phone={user.phone} username={user.username} avatarUrl={user.avatar_url} preferences={user.preferences} mustChangePassword={user.must_change_password} />;
}
