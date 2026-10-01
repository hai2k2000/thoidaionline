import readXlsxFile from "read-excel-file/node";
import { reporterLanguageLabel } from "./onlineWorkLanguage.mjs";

const GROUPS = new Set(["Anh", "Trung", "Lào", "Khmer", "Nga", "Các tổ làm online"]);
const normalize = (value) => String(value ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
const asIsoDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  const match = normalize(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const candidate = `${match[3]}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
  const date = new Date(`${candidate}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== candidate ? null : candidate;
};

export function parseOnlineWorkWorkbook(workbook) {
  const rows = workbook?.sheets?.[0]?.rows;
  if (!Array.isArray(rows)) throw new Error("Không tìm thấy sheet đầu tiên trong file Excel.");
  const byDate = new Map();
  let month = null;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const dates = new Map();
    row.forEach((cell, column) => { const date = asIsoDate(cell); if (date) dates.set(column, date); });
    if (dates.size < 2) continue;
    const assignmentRow = rows[index + 1] ?? [];
    for (const [column, date] of dates) {
      const currentMonth = date.slice(0, 7);
      if (month && month !== currentMonth) throw new Error("File chứa nhiều tháng khác nhau.");
      month = currentMonth;
      if (byDate.has(date)) throw new Error(`Ngày ${date} bị lặp trong file.`);
      const group = normalize(assignmentRow[column]);
      if (!GROUPS.has(group)) throw new Error(`Tổ ngoại ngữ không hợp lệ tại ngày ${date}.`);
      byDate.set(date, { date, groups: [group] });
    }
    index += 1;
  }
  if (!month || !byDate.size) throw new Error("File không có ngày làm online hợp lệ.");
  return { month, days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

export async function readOnlineWorkWorkbook(buffer) {
  return parseOnlineWorkWorkbook({ sheets: [{ rows: await readXlsxFile(buffer) }] });
}

export function resolveOnlineWorkImport(parsed, people) {
  const errors = [];
  const days = parsed.days.map(({ date, groups }) => {
    const staffIds = people.filter((person) => {
      const language = reporterLanguageLabel(person.username);
      return groups.includes("Các tổ làm online") || groups.some((group) => language === `Tiếng ${group}`);
    }).map((person) => person.id);
    if (!staffIds.length) errors.push({ date, reason: "Không tìm thấy phóng viên phù hợp." });
    return { date, staffIds };
  });
  return { days, errors };
}
