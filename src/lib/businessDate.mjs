const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";

export function formatDateOnlyVN(value) {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) throw new Error("Invalid date-only value");
  const [year, month, day] = value.split("-");
  const probe = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(probe.getTime()) || new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(probe) !== value) throw new Error("Invalid date-only value");
  return `${day}/${month}/${year}`;
}

export function businessDateFromTimestamp(value) {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) throw new Error("Invalid timestamp");
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE }).format(instant);
}

export { BUSINESS_TIME_ZONE };

export function completionDateFromTaskTimestamp(value) { return value ? businessDateFromTimestamp(value) : null; }
