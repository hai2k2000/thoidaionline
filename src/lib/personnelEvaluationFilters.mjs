const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const one = (value) => Array.isArray(value) ? value[0] : value;

const validDate = (value) => {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value;
};

export function parsePersonnelEvaluationFilters(input, today) {
  const year = validDate(today) ? today.slice(0, 4) : "1970";
  const from = one(input.from) || `${year}-01-01`;
  const to = one(input.to) || `${year}-12-31`;
  const employee = one(input.employee);
  if (!validDate(from) || !validDate(to) || from > to) {
    return { ok: false, from, to, employeeId: null };
  }
  if (employee !== undefined && employee !== "" && !UUID.test(employee)) {
    return { ok: false, from, to, employeeId: null };
  }
  return { ok: true, from, to, employeeId: employee || null };
}
