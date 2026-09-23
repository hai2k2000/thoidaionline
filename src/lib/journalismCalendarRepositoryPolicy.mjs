export function calendarActorScope(actor) {
  if (actor?.departmentCode !== "editorial") return null;
  const leadership = ["admin", "tong_bien_tap", "pho_tong_bien_tap"].includes(actor.roleCode ?? "");
  return { departmentId: actor.departmentId ?? null, scope: leadership ? "all" : "assigned" };
}

export function plannedPublicationPatch(value) {
  return { p_planned_publication_at: value };
}
