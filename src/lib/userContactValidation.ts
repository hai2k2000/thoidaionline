const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9][0-9()\-\s]*$/;

export function validateEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return normalized.length <= 254 && EMAIL_PATTERN.test(normalized) ? normalized : null;
}

export function validatePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const digits = normalized.replace(/\D/g, "");
  return normalized.length <= 32 && digits.length >= 7 && digits.length <= 15 && PHONE_PATTERN.test(normalized)
    ? normalized
    : null;
}
