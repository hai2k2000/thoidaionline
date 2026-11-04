export const MAX_TASK_REQUIREMENTS = 50;
export const MAX_REQUIREMENT_LENGTH = 2000;
export function parseTaskRequirements(value: string | null | undefined): string[] {
  const raw = value?.trim() ?? "";
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((item): item is string => typeof item === "string")) return parsed.map(item => item.trim()).filter(Boolean);
  } catch { /* Historical requirements can be plain text. */ }
  return raw.split(/\r\n|\r|\n/).map(item => item.trim()).filter(Boolean);
}
export function serializeAdminRequirements(requirements: string[]) {
  const items = requirements.map(item => item.trim()).filter(Boolean);
  if (requirements.length && !items.length) throw new Error("Hãy xóa tất cả các dòng nếu muốn bỏ toàn bộ yêu cầu công việc.");
  if (items.length > MAX_TASK_REQUIREMENTS || items.some(item => item.length > MAX_REQUIREMENT_LENGTH)) throw new Error("Too many or too long requirements");
  const serialized = JSON.stringify(items);
  if (serialized.length > 10000) throw new Error("Requirements exceed 10000 characters");
  return serialized;
}
