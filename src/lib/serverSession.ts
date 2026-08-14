import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { serverSupabase } from "@/lib/serverSupabase";

export const SESSION_COOKIE = "thoidai_work_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

type SessionPayload = { userId: string; expiresAt: number };

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

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSessionToken(userId: string) {
  const payload = Buffer.from(JSON.stringify({
    userId,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  } satisfies SessionPayload)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = sign(payload);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    if (!parsed.userId || !parsed.expiresAt || parsed.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<ServerAuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token);
  if (!session) return null;
  const { data, error } = await serverSupabase
    .from("staff_users")
    .select("id,full_name,email,username,active,roles(code,name,role_permissions(can_manage_users,can_manage_permissions,can_create_task,can_edit_all_tasks,can_comment))")
    .eq("id", session.userId)
    .eq("active", true)
    .single();
  if (error || !data) return null;
  const row = data as unknown as {
    id: string; full_name: string; email: string | null; username: string | null; active: boolean;
    roles: { code: string; name: string; role_permissions: ServerAuthUser["permissions"] | null } | null;
  };
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
