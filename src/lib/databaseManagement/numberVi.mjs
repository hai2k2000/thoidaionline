// Vietnamese number grouping for CSDL number fields: 33000000 <-> "33.000.000".
// Year fields ("Năm ...") keep plain digits.

/** @param {{ data_type?: string; label?: string } | null | undefined} field */
export function usesGroupedNumber(field) {
  return field?.data_type === "number" && !/^\s*năm\b/i.test(field.label ?? "");
}

/** @param {unknown} value */
export function formatGroupedNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return typeof value === "string" ? value : "";
  const negative = value < 0;
  const [whole, fraction] = Math.abs(value).toString().split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${grouped}${fraction ? `,${fraction}` : ""}`;
}

/**
 * Parse what the user typed ("33.000.000", "1.234,5", "-50") into a number.
 * Returns "" for empty input and null for anything that is not a number.
 * @param {string} text
 */
export function parseGroupedNumber(text) {
  const trimmed = text.replace(/\s/g, "");
  if (trimmed === "") return "";
  if (!/^-?[\d.]*(,\d*)?$/.test(trimmed)) return null;
  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  if (normalized === "" || normalized === "-" || normalized === ".") return null;
  const number = Number(normalized.endsWith(".") ? normalized.slice(0, -1) : normalized);
  return Number.isFinite(number) ? number : null;
}

/**
 * Re-group the digits while typing; keeps a trailing comma or decimal digits as typed.
 * @param {string} text
 */
export function formatGroupedInput(text) {
  const trimmed = text.replace(/\s/g, "");
  const match = /^(-?)([\d.]*)(,\d*)?$/.exec(trimmed);
  if (!match) return null;
  const digits = match[2].replace(/\./g, "").replace(/^0+(?=\d)/, "");
  return `${match[1]}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${match[3] ?? ""}`;
}
