export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;
export const PASSWORD_SYMBOL_PATTERN = /[^A-Za-z0-9\s]/;

export const PASSWORD_POLICY_HINT =
  "Mật khẩu phải có 12-128 ký tự, gồm chữ thường, chữ hoa, số và ký tự đặc biệt; không có khoảng trắng ở đầu hoặc cuối.";

export function getPasswordPolicyError(value: string) {
  if (value.length < MIN_PASSWORD_LENGTH || value.length > MAX_PASSWORD_LENGTH) return PASSWORD_POLICY_HINT;
  if (value !== value.trim()) return PASSWORD_POLICY_HINT;
  if (!/[a-z]/.test(value)) return PASSWORD_POLICY_HINT;
  if (!/[A-Z]/.test(value)) return PASSWORD_POLICY_HINT;
  if (!/\d/.test(value)) return PASSWORD_POLICY_HINT;
  if (!PASSWORD_SYMBOL_PATTERN.test(value)) return PASSWORD_POLICY_HINT;
  return null;
}
