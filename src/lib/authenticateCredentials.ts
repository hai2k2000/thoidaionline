import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";
import { hashPassword, isBcryptHash, verifyPassword } from "@/lib/password";
import { DEFAULT_FIRST_LOGIN_PASSWORD } from "@/lib/defaultPassword";

type CredentialRow = {
  id: string;
  username: string | null;
  password: string | null;
  password_hash: string | null;
  active: boolean;
  session_version: number;
  must_change_password: boolean;
  roles?: { active: boolean } | null;
};

export async function authenticateCredentials(identifierInput: string, passwordInput: string) {
  const identifier = identifierInput.trim().toLowerCase();
  const password = passwordInput.trim();
  if (!identifier || !password) return null;
  const roleLifecycleEnabled = process.env.ROLE_LIFECYCLE_ENABLED === "true";
  const { data, error } = await serverSupabase
    .from("staff_users")
    .select(`id,username,password,password_hash,active,session_version,must_change_password${roleLifecycleEnabled ? ",roles!inner(active)" : ""}`)
    .or(`username.eq.${identifier},email.ilike.${identifier},phone.eq.${identifier}`)
    .limit(1)
    .maybeSingle();
  const row = data as CredentialRow | null;
  if (error || !row) return null;
  const valid = row.active
    && (!roleLifecycleEnabled || row.roles?.active === true)
    && (isBcryptHash(row.password_hash)
      ? await verifyPassword(password, row.password_hash)
      : (row.password ?? DEFAULT_FIRST_LOGIN_PASSWORD).trim() === password);
  if (!valid) return null;
  if (!isBcryptHash(row.password_hash)) {
    let upgradeQuery = serverSupabase.from("staff_users")
      .update({
        password_hash: await hashPassword(password),
        password: null,
        must_change_password: password === DEFAULT_FIRST_LOGIN_PASSWORD,
      })
      .eq("id", row.id).eq("session_version", row.session_version);
    upgradeQuery = row.password_hash === null ? upgradeQuery.is("password_hash", null) : upgradeQuery.eq("password_hash", row.password_hash);
    upgradeQuery = row.password === null ? upgradeQuery.is("password", null) : upgradeQuery.eq("password", row.password);
    const { data: upgraded, error: upgradeError } = await upgradeQuery.select("id").maybeSingle();
    if (upgradeError || !upgraded) return null;
  }
  return {
    userId: row.id,
    sessionVersion: row.session_version,
    mustChangePassword: false,
  };
}
