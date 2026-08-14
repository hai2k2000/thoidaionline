export type AdminResetTarget = {
  id: string;
  email: string | null;
  active: boolean;
};

export type AdminResetCode =
  | "reset_email_sent"
  | "reset_prepare_failed"
  | "email_delivery_failed"
  | "audit_finalize_failed";

type PreparedReset = { tokenId: string; auditId: string };

export function getAdminResetTargetError(target: AdminResetTarget | null) {
  if (!target) return "user_not_found" as const;
  if (!target.active) return "user_inactive" as const;
  if (!target.email?.trim()) return "email_missing" as const;
  return null;
}

export async function executeAdminPasswordReset({
  actorId,
  target,
  request,
  createToken,
  prepare,
  sendEmail,
  finalize,
}: {
  actorId: string;
  target: AdminResetTarget & { email: string };
  request: Request;
  createToken: () => { token: string; hash: string };
  prepare: (input: {
    actorId: string;
    userId: string;
    tokenHash: string;
    expiresAt: string;
  }) => Promise<PreparedReset | null>;
  sendEmail: (email: string, token: string, request: Request) => Promise<boolean>;
  finalize: (input: PreparedReset & { status: "sent" | "failed" }) => Promise<boolean>;
}): Promise<{ ok: true; code: "reset_email_sent" } | { ok: false; code: Exclude<AdminResetCode, "reset_email_sent"> }> {
  const { token, hash } = createToken();
  let prepared: PreparedReset | null;
  try {
    prepared = await prepare({
      actorId,
      userId: target.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  } catch {
    return { ok: false, code: "reset_prepare_failed" };
  }
  if (!prepared) return { ok: false, code: "reset_prepare_failed" };

  let delivered = false;
  try {
    delivered = await sendEmail(target.email, token, request);
  } catch {
    delivered = false;
  }

  let finalized = false;
  try {
    finalized = await finalize({
      ...prepared,
      status: delivered ? "sent" : "failed",
    });
  } catch {
    return { ok: false, code: "audit_finalize_failed" };
  }
  if (!finalized) return { ok: false, code: "audit_finalize_failed" };
  return delivered
    ? { ok: true, code: "reset_email_sent" }
    : { ok: false, code: "email_delivery_failed" };
}
