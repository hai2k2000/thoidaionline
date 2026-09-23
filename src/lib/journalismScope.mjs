export const CONTENT_DEPARTMENT_CODE = "editorial";
export const GLOBAL_JOURNALISM_ROLES = new Set(["admin", "tong_bien_tap", "pho_tong_bien_tap"]);

export function canAccessJournalismScope(actor) {
  return GLOBAL_JOURNALISM_ROLES.has(actor?.roleCode ?? "")
    || actor?.departmentCode === CONTENT_DEPARTMENT_CODE;
}

export function canUseJournalism(actor) {
  return canAccessJournalismScope(actor)
    && (actor?.rbacPermissions?.some((permission) => permission.startsWith("journalism.")) ?? false);
}
