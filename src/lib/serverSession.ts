import "server-only";

import { cookies, headers } from "next/headers";
import { serverSupabase } from "@/lib/serverSupabase";
import {
  createSignedSessionToken,
  SESSION_TTL_SECONDS,
  verifySignedSessionToken,
} from "@/lib/sessionToken";
import {
  normalizePermissions,
  type PermissionSet,
} from "@/lib/permissions";
import { normalizeAccountPreferences, type AccountPreferences } from "@/lib/accountPreferences";

export const SESSION_COOKIE = "thoidai_work_session";

export type ServerAuthUser = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  department_id: string | null;
  role_code: string;
  role_name: string;
  role_level: number;
  active: boolean;
  session_version: number;
  is_department_manager: boolean;
  permissions: PermissionSet;
  avatar_url: string | null;
  preferences: AccountPreferences;
};

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return value;
}

export function createSessionToken(userId: string, sessionVersion: number) {
  return createSignedSessionToken({ userId, sessionVersion, secret: secret() });
}

export function verifySessionToken(token: string | undefined) {
  return verifySignedSessionToken({ token, secret: secret() });
}

export async function getSessionUser(): Promise<ServerAuthUser | null> {
  const requestHeaders = await headers();
  const authorization = requestHeaders.get("authorization");
  const bearer = authorization?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  const cookieToken = (await cookies()).get(SESSION_COOKIE)?.value;
  const token = cookieToken ?? bearer;
  const session = verifySessionToken(token);
  if (!session) return null;

  const roleLifecycleEnabled = process.env.ROLE_LIFECYCLE_ENABLED === "true";
  const { data, error } = await serverSupabase
    .from("staff_users")
    .select(
      "id,full_name,email,phone,username,department_id,job_title_id,active,session_version,avatar_path,preferences," +
      `roles(code,name,level${roleLifecycleEnabled ? ",active" : ""},role_permissions(` +
      "can_manage_users,can_manage_permissions,can_create_task," +
      "can_edit_all_tasks,can_comment,can_assign_task," +
      "can_view_department_tasks,can_evaluate_step1," +
      "can_evaluate_step2,can_manage_rubrics)),job_titles(code)",
    )
    .eq("id", session.userId)
    .eq("active", true)
    .single();
  if (error || !data) return null;

  const row = data as unknown as {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    username: string | null;
    department_id: string | null;
    job_titles: { code: string } | null;
    active: boolean;
    session_version: number;
    avatar_path: string | null;
    preferences: unknown;
    roles: {
      code: string;
      name: string;
      level: number;
      active?: boolean;
      role_permissions: Partial<PermissionSet> | null;
    } | null;
  };
  if (session.sessionVersion !== row.session_version) return null;
  if (!row.roles || (roleLifecycleEnabled && row.roles.active !== true)) return null;
  const isDepartmentManager = row.job_titles?.code === "truong_phong";
  const avatarResult = row.avatar_path
    ? await serverSupabase.storage.from("profile-avatars").createSignedUrl(row.avatar_path, 3600)
    : null;

  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    username: row.username,
    department_id: row.department_id,
    role_code: row.roles.code,
    role_name: row.roles.name,
    role_level: row.roles.level,
    active: row.active,
    session_version: row.session_version,
    is_department_manager: isDepartmentManager,
    permissions: normalizePermissions(row.roles.role_permissions),
    avatar_url: avatarResult?.data?.signedUrl ?? null,
    preferences: normalizeAccountPreferences(row.preferences),
  };
}

export async function isSameOriginRequest() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
