import "server-only";

export type AuthDiagnosticValue = boolean | number | string | null;

export type AuthDiagnosticState = {
  enabled: boolean;
  emitted: boolean;
  event: Record<string, AuthDiagnosticValue>;
};

function diagnosticEnabled() {
  return process.env.AUTH_DIAGNOSTIC_ENABLED === "true";
}

export function beginAuthDiagnostic(identifierInput: string, passwordInput: string): AuthDiagnosticState | undefined {
  if (!diagnosticEnabled()) return undefined;
  const trimmedPassword = passwordInput.trim();
  return {
    enabled: true,
    emitted: false,
    event: {
      auth_diag: true,
      identifier: /^[A-Za-z0-9._-]{1,64}$/.test(identifierInput.trim()) ? identifierInput.trim().toLowerCase() : "",
      user_found: false,
      user_active: false,
      role_found: false,
      role_active: false,
      password_present: trimmedPassword.length > 0,
      password_length: passwordInput.length,
      password_trim_changed: passwordInput.length !== trimmedPassword.length,
      hash_present: false,
      hash_format_valid: false,
      verifier_reached: false,
      verifier_result: null,
      legacy_upgrade_reached: false,
      legacy_upgrade_result: null,
      session_creation_reached: false,
      auth_result: "other",
    },
  };
}

export function updateAuthDiagnostic(
  state: AuthDiagnosticState | undefined,
  patch: Record<string, AuthDiagnosticValue>,
) {
  if (!state?.enabled || state.emitted) return;
  Object.assign(state.event, patch);
}

export function emitAuthDiagnostic(
  state: AuthDiagnosticState | undefined,
  patch: Record<string, AuthDiagnosticValue> = {},
) {
  if (!state?.enabled || state.emitted) return;
  Object.assign(state.event, patch);
  console.info(JSON.stringify(state.event));
  state.emitted = true;
}
