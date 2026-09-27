import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";
import { hashPassword, isBcryptHash, verifyPassword } from "@/lib/password";
import { DEFAULT_FIRST_LOGIN_PASSWORD } from "@/lib/defaultPassword";
import {
  AuthDiagnosticState,
  beginAuthDiagnostic,
  emitAuthDiagnostic,
  updateAuthDiagnostic,
} from "@/lib/authDiagnostic";

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

export async function authenticateCredentials(
  identifierInput: string,
  passwordInput: string,
  diagnosticState?: AuthDiagnosticState,
) {
  const identifier = identifierInput.trim().toLowerCase();
  const password = passwordInput.trim();
  const diagnostic = diagnosticState ?? beginAuthDiagnostic(identifierInput, passwordInput);
  if (!identifier || !password) {
    emitAuthDiagnostic(diagnostic, { auth_result: "lookup_failed" });
    return null;
  }
  const roleLifecycleEnabled = process.env.ROLE_LIFECYCLE_ENABLED === "true";
  const { data, error } = await serverSupabase
    .from("staff_users")
    .select(`id,username,password,password_hash,active,session_version,must_change_password${roleLifecycleEnabled ? ",roles!inner(active)" : ""}`)
    .or(`username.eq.${identifier},email.ilike.${identifier},phone.eq.${identifier}`)
    .limit(1)
    .maybeSingle();
  const row = data as CredentialRow | null;
  if (error || !row) {
    emitAuthDiagnostic(diagnostic, { auth_result: "lookup_failed" });
    return null;
  }
  const hasBcryptHash = isBcryptHash(row.password_hash);
  updateAuthDiagnostic(diagnostic, {
    user_found: true,
    user_active: row.active,
    role_found: !roleLifecycleEnabled || Boolean(row.roles),
    role_active: !roleLifecycleEnabled || row.roles?.active === true,
    password_present: typeof row.password === "string" && row.password.length > 0,
    hash_present: typeof row.password_hash === "string" && row.password_hash.length > 0,
    hash_format_valid: hasBcryptHash,
  });
  if (!row.active) {
    emitAuthDiagnostic(diagnostic, { auth_result: "inactive_user" });
    return null;
  }
  if (roleLifecycleEnabled && row.roles?.active !== true) {
    emitAuthDiagnostic(diagnostic, { auth_result: "inactive_role" });
    return null;
  }
  let valid = false;
  if (hasBcryptHash) {
    updateAuthDiagnostic(diagnostic, { verifier_reached: true });
    try {
      valid = await verifyPassword(password, row.password_hash);
    } catch (error) {
      emitAuthDiagnostic(diagnostic, {
        verifier_result: false,
        auth_result: "other",
        error_name: error instanceof Error ? error.name : "unknown",
      });
      throw error;
    }
    updateAuthDiagnostic(diagnostic, { verifier_result: valid });
  } else {
    valid = (row.password ?? DEFAULT_FIRST_LOGIN_PASSWORD).trim() === password;
  }
  if (!valid) {
    emitAuthDiagnostic(diagnostic, { auth_result: hasBcryptHash ? "bcrypt_mismatch" : "other" });
    return null;
  }
  if (!isBcryptHash(row.password_hash)) {
    updateAuthDiagnostic(diagnostic, { legacy_upgrade_reached: true });
    if (process.env.AUTH_DIAGNOSTIC_BLOCK_LEGACY_UPGRADE === "true") {
      emitAuthDiagnostic(diagnostic, { legacy_upgrade_result: false, auth_result: "legacy_upgrade_failed" });
      return null;
    }
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
    if (upgradeError || !upgraded) {
      emitAuthDiagnostic(diagnostic, { legacy_upgrade_result: false, auth_result: "legacy_upgrade_failed" });
      return null;
    }
    updateAuthDiagnostic(diagnostic, { legacy_upgrade_result: true });
  }
  return {
    userId: row.id,
    sessionVersion: row.session_version,
    mustChangePassword: false,
  };
}
