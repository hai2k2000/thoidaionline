import "server-only";

import { cookies, headers } from "next/headers";
import { serverSupabase } from "@/lib/serverSupabase";
import {
  createSignedSessionToken,
  SESSION_TTL_SECONDS,
  verifySignedSessionToken,
} from "@/lib/sessionToken";

export const SESSION_COOKIE = "thoidai_work_session";

export type ServerAuthUser = {
  id: string;
  full_name: string;
  email: string | null;
  username: string | null;
  role_code: string;
  role_name: string;
  active: boolean;
  permissions: Record<"can_manage_users" | "can_manage_permissions" | "can_create_task" | "can_edit_all_tasks" | "can_comment", boolean>;
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
    .select("id,full_name,email,username,active,session_version,roles(code,name,role_permissions(can_manage_users,can_manage_permissions,can_create_task,can_edit_all_tasks,can_comment))")
    .eq("id", session.userId)
    .eq("active", true)
    .single();
  if (error || !data) return null;
  const row = data as unknown as {
    id: string; full_name: string; email: string | null; username: string | null; active: boolean; session_version: number;
    roles: { code: string; name: string; role_permissions: ServerAuthUser["permissions"] | null } | null;
  };
  if (session.sessionVersion !== row.session_version) return null;
  const permissions = row.roles?.role_permissions;
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    username: row.username,
    role_code: row.roles?.code ?? "",
    role_name: row.roles?.name ?? "",
    active: row.active,
    permissions: {
      can_manage_users: !!permissions?.can_manage_users,
      can_manage_permissions: !!permissions?.can_manage_permissions,
      can_create_task: !!permissions?.can_create_task,
      can_edit_all_tasks: !!permissions?.can_edit_all_tasks,
      can_comment: !!permissions?.can_comment,
    },
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
