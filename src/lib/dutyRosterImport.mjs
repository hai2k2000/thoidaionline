import { normalizeDutyRosterName } from "./dutyRosterExcel.mjs";

const positions = ["Xuất bản", "Biên tập", "Phóng viên"];
const approvedAliases = new Map([
  ["mai anh", "maianh"],
  ["hai doan", "thidoan"],
  ["hong ninh", "hongninh"],
  ["pham ly", "thily"],
]);
const withoutMarks = (value) => normalizeDutyRosterName(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function resolveDutyImportRows(rows, people) {
  const byName = new Map();
  const byUsername = new Map();
  for (const person of people) {
    const username = normalizeDutyRosterName(person.username);
    if (username) byUsername.set(username, [...(byUsername.get(username) ?? []), person]);
    for (const value of [person.full_name, person.username]) {
      const key = normalizeDutyRosterName(value);
      if (!key) continue;
      byName.set(key, [...(byName.get(key) ?? []), person]);
    }
  }
  const resolved = [];
  const errors = [];
  for (const row of rows) {
    const direct = byName.get(normalizeDutyRosterName(row.name)) ?? [];
    const alias = approvedAliases.get(withoutMarks(row.name));
    const candidates = direct.length ? direct : alias ? (byUsername.get(alias) ?? []) : [];
    const matches = [...new Map(candidates.map((person) => [person.id, person])).values()];
    if (!matches.length) errors.push({ row, reason: `Không tìm thấy nhân sự "${row.name}".` });
    else if (matches.length > 1) errors.push({ row, reason: `Tên "${row.name}" trùng nhiều tài khoản.` });
    else resolved.push({ ...row, assigneeId: matches[0].id });
  }
  return { resolved, errors };
}

export function groupDutyImportRows(rows) {
  const byDate = new Map();
  for (const row of rows) byDate.set(row.date, [...(byDate.get(row.date) ?? []), { position: row.position, assigneeId: row.assigneeId }]);
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, assignments]) => ({ date, assignments }));
}

export function validateDutyImportRows(month, rows) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return false;
  const expectedDays = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  if (rows.length !== expectedDays * positions.length) return false;
  const seen = new Set();
  const dates = new Set();
  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !row.date.startsWith(`${month}-`) || !positions.includes(row.position) || !row.name.trim()) return false;
    const parsed = new Date(`${row.date}T00:00:00Z`);
    if (parsed.toISOString().slice(0, 10) !== row.date) return false;
    dates.add(row.date);
    const key = `${row.date}|${row.position}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return dates.size === expectedDays && [...Array.from({ length: expectedDays }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`)].every((date) => dates.has(date)) && seen.size === expectedDays * positions.length;
}

export function summarizeDutyImport(rows, existing, target = {}) {
  const current = new Map(existing.map((row) => [`${row.due_date}|${row.duty_position}`, row]));
  let create = 0; let update = 0; let unchanged = 0; let locked = 0;
  for (const row of rows) {
    const old = current.get(`${row.date}|${row.position}`);
    if (!old) create += 1;
    else if (old.assignee_id === row.assigneeId && (!target.departmentId || old.department_id === target.departmentId) && (!target.reviewerId || old.reviewer_id === target.reviewerId)) unchanged += 1;
    else { update += 1; if (old.status !== "new") locked += 1; }
    current.delete(`${row.date}|${row.position}`);
  }
  return { create, update, unchanged, cancel: current.size, locked };
}
