export function formatIsoDateVi(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? match[3] + "/" + match[2] + "/" + match[1] : iso;
}

export function parseViDate(text) {
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text.trim());
  if (!match) return null;
  const day = Number(match[1]); const month = Number(match[2]); const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return String(year).padStart(4, "0") + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}

export function formatViDateInput(raw) {
  if (/^(\d{2}\/){0,2}\d*$/.test(raw)) {
    const digits = raw.replace(/\//g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return digits.slice(0, 2) + "/" + digits.slice(2);
    return digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);
  }
  if (/[/.-]/.test(raw)) return raw.replace(/[.-]/g, "/").replace(/[^0-9/]/g, "").slice(0, 10);
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.slice(0, 2) + "/" + digits.slice(2);
  return digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);
}
