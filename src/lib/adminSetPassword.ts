export type AdminSetPasswordTarget = {
  id: string;
  active: boolean;
};

export function getAdminSetPasswordTargetError(target: AdminSetPasswordTarget | null) {
  if (!target) return "user_not_found" as const;
  if (!target.active) return "user_inactive" as const;
  return null;
}

export async function executeAdminSetPassword({
  actorId,
  target,
  newPassword,
  hashPassword,
  setPassword,
}: {
  actorId: string;
  target: AdminSetPasswordTarget;
  newPassword: string;
  hashPassword: (value: string) => Promise<string>;
  setPassword: (input: { actorId: string; userId: string; passwordHash: string }) => Promise<boolean>;
}) {
  const passwordHash = await hashPassword(newPassword);
  return setPassword({ actorId, userId: target.id, passwordHash });
}
