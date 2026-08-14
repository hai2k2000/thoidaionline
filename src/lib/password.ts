import "server-only";

import bcrypt from "bcryptjs";

export function isBcryptHash(value: string | null | undefined) {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);
}

export async function hashPassword(value: string) {
  return bcrypt.hash(value, 12);
}

export async function verifyPassword(value: string, hash: string | null | undefined) {
  if (!hash) return false;
  return bcrypt.compare(value, hash);
}
