export const SENSITIVE_RECORD_TYPE_CODES = new Set([
  "ho_so_dang",
  "chi_hoi_nha_bao",
  "doan_thanh_nien",
  "giay_phep_quan_ly_bao_chi",
]);

export const SENSITIVE_RECORD_PERMISSION = "record.sensitive.access";

export function isSensitiveRecordTypeCode(code: string | null | undefined) {
  return Boolean(code && SENSITIVE_RECORD_TYPE_CODES.has(code));
}

export function canAccessSensitiveRecordType(actor: { rbacPermissions: readonly string[] }) {
  return actor.rbacPermissions.includes(SENSITIVE_RECORD_PERMISSION);
}

export function canAccessRecordType(actor: { rbacPermissions: readonly string[] }, code: string | null | undefined) {
  return !isSensitiveRecordTypeCode(code) || canAccessSensitiveRecordType(actor);
}
