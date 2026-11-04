export const MAX_TASK_REQUIREMENTS = 50;
export const MAX_REQUIREMENT_LENGTH = 2000;
export function parseAdminRequirements(value: string | null | undefined) {
  const raw = value ?? "";
  if (!raw) return { mode: "json" as const, requirements: [] as string[] };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((item): item is string => typeof item === "string")) return { mode: "json" as const, requirements: parsed };
  } catch { /* Preserve legacy text exactly. */ }
  return { mode: "legacy" as const, text: raw };
}
export function serializeAdminRequirements(requirements: string[]) {
  if (requirements.length > MAX_TASK_REQUIREMENTS || requirements.some(item => item.length > MAX_REQUIREMENT_LENGTH)) throw new Error("Too many or too long requirements");
  const serialized = JSON.stringify(requirements);
  if (serialized.length > 10000) throw new Error("Requirements exceed 10000 characters");
  return serialized;
}
