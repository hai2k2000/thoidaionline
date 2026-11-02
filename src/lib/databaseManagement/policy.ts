export const SENSITIVE_RECORD_PERMISSION = "record.sensitive.access";
export const SENSITIVE_RECORD_TYPE_CODES = new Set(["ho_so_dang", "chi_hoi_nha_bao", "doan_thanh_nien", "giay_phep_quan_ly_bao_chi"]);
export type CategoryGrantLevel = "view" | "contribute" | "approve";

export function isSensitiveRecordTypeCode(code: string | null | undefined) {
  return Boolean(code && SENSITIVE_RECORD_TYPE_CODES.has(code));
}

export function isSensitiveRecordType(code: string | null | undefined) {
  return isSensitiveRecordTypeCode(code);
}

export function canAccessSensitiveRecordType(actor: { rbacPermissions: readonly string[] }) {
  return actor.rbacPermissions.includes(SENSITIVE_RECORD_PERMISSION);
}

export function canAccessRecordType(actor: { rbacPermissions: readonly string[] }, code: string | null | undefined) {
  return !isSensitiveRecordType(code) || canAccessSensitiveRecordType(actor);
}

export function canSeeRestricted(actor: { rbacPermissions: readonly string[] }, grantLevel: CategoryGrantLevel | null) {
  return canAccessSensitiveRecordType(actor) || grantLevel !== null;
}

export function canContributeRestricted(actor: { rbacPermissions: readonly string[] }, grantLevel: CategoryGrantLevel | null) {
  return actor.rbacPermissions.includes("record.create") && (canAccessSensitiveRecordType(actor) || grantLevel === "contribute" || grantLevel === "approve");
}

export function canApproveRestricted(actor: { rbacPermissions: readonly string[] }, grantLevel: CategoryGrantLevel | null) {
  return canAccessSensitiveRecordType(actor) || grantLevel === "approve";
}
