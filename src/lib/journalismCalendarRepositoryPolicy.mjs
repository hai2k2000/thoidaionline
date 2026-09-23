export function calendarActorScope(actor) {
  const global = ["admin", "tong_bien_tap", "pho_tong_bien_tap"].includes(actor?.roleCode ?? "");
  if (!global && actor?.departmentCode !== "editorial") return null;
  const leadership = global || ["admin", "truong_phong", "pho_truong_phong", "phu_trach_phong_bien_tap", "phu_trach_phong_phong_vien", "phu_trach_phong_tri_su"].includes(actor.roleCode ?? "");
  return { departmentId: actor.departmentId ?? null, scope: leadership ? "all" : "assigned" };
}

export function plannedPublicationPatch(value) {
  return { p_planned_publication_at: value };
}
