const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function consumeLoginAttempt(identifier: string) {
  const now = Date.now();
  const current = attempts.get(identifier);
  if (!current || current.resetAt <= now) {
    attempts.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  return {
    allowed: current.count <= MAX_ATTEMPTS,
    retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export function clearLoginAttempts(identifier: string) {
  attempts.delete(identifier);
}
