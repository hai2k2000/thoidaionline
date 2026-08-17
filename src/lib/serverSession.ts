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

export const SESSION_COOKIE = "thoidai_work_session";

export type ServerAuthUser = {
  id: string;
  full_name: string;
  email: string | null;
  username: string | null;
  department_id: string | null;
  role_code: string;
  role_name: string;
  role_level: number;
  active: boolean;
  permissions: PermissionSet;
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
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token);
  if (!session) return null;

  const { data, error } = await serverSupabase
    .from("staff_users")
    .select(
      "id,full_name,email,username,department_id,active,session_version," +
      "roles(code,name,level,role_permissions(" +
      "can_manage_users,can_manage_permissions,can_create_task," +
      "can_edit_all_tasks,can_comment,can_assign_task," +
      "can_view_department_tasks,can_evaluate_step1," +
      "can_evaluate_step2,can_manage_rubrics))",
    )
    .eq("id", session.userId)
    .eq("active", true)
    .single();
  if (error || !data) return null;

  const row = data as unknown as {
    id: string;
    full_name: string;
    email: string | null;
    username: string | null;
    department_id: string | null;
    active: boolean;
    session_version: number;
    roles: {
      code: string;
      name: string;
      level: number;
      role_permissions: Partial<PermissionSet> | null;
    } | null;
  };
  if (session.sessionVersion !== row.session_version) return null;
  if (!row.roles) return null;

  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    username: row.username,
    department_id: row.department_id,
    role_code: row.roles.code,
    role_name: row.roles.name,
    role_level: row.roles.level,
    active: row.active,
    permissions: normalizePermissions(row.roles.role_permissions),
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
