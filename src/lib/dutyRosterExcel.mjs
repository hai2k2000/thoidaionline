import readXlsxFile from "read-excel-file/node";

export const DUTY_IMPORT_POSITIONS = ["Xuất bản", "Biên tập", "Phóng viên"];

const normalizeText = (value) => String(value ?? "").normalize("NFC").replace(/\s+/g, " ").trim();

export function normalizeDutyRosterName(value) {
  return normalizeText(value).toLocaleLowerCase("vi-VN");
}

function asIsoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
  }
  return null;
}

const daysInMonth = (month) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();

function fail(message) {
  throw new Error(message);
}

export function parseDutyRosterWorkbook(workbook) {
  const sheet = workbook?.sheets?.find((item) => Array.isArray(item?.rows) && item.rows.some((row) => row?.some((cell) => cell != null)));
  if (!sheet) fail("Không tìm thấy sheet dữ liệu lịch trực.");
  const rows = sheet.rows;
  const headerIndex = rows.findIndex((row) => normalizeDutyRosterName(row?.[0]).includes("nhân sự/ngày"));
  if (headerIndex < 0) fail("Không nhận diện được dòng tiêu đề Nhân sự/Ngày.");

  const dateHeaders = new Map();
  let currentMonth = null;
  const assignments = [];
  let currentDates = null;
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const foundDates = new Map();
    for (let column = 1; column < row.length; column += 1) {
      const date = asIsoDate(row[column]);
      if (date) foundDates.set(column, date);
    }
    if (foundDates.size) {
      currentDates = foundDates;
      for (const [column, date] of foundDates) {
        const month = date.slice(0, 7);
        if (currentMonth && month !== currentMonth) fail("File chứa nhiều tháng khác nhau.");
        currentMonth = month;
        if (dateHeaders.has(date)) fail(`Ngày ${date} bị lặp trong file.`);
        dateHeaders.set(date, column);
      }
      continue;
    }
    const position = normalizeText(row[0]);
    if (!DUTY_IMPORT_POSITIONS.includes(position)) {
      const hasValues = row.some((cell) => cell != null && normalizeText(cell));
      if (currentDates && position && hasValues) fail(`Vị trí không hợp lệ: ${position}.`);
      continue;
    }
    if (!currentDates) fail(`Thiếu dòng ngày trước vị trí ${position}.`);
    for (const [column, date] of currentDates) {
      const name = normalizeText(row[column]);
      if (!name) fail(`Thiếu nhân sự ${position} ngày ${date}.`);
      assignments.push({ date, position, name });
    }
  }
  if (!currentMonth || !dateHeaders.size) fail("File không có ngày trực hợp lệ.");
  const expectedDays = daysInMonth(currentMonth);
  if (dateHeaders.size !== expectedDays) fail(`File phải có đủ ${expectedDays} ngày của tháng ${currentMonth}.`);
  const expectedRows = expectedDays * DUTY_IMPORT_POSITIONS.length;
  if (assignments.length !== expectedRows) fail(`File phải có đủ ${expectedRows} phân công cho tháng ${currentMonth}.`);
  const seen = new Set();
  for (const row of assignments) {
    const key = `${row.date}|${row.position}`;
    if (seen.has(key)) fail(`Phân công ${row.position} ngày ${row.date} bị lặp.`);
    seen.add(key);
  }
  assignments.sort((a, b) => a.date.localeCompare(b.date) || DUTY_IMPORT_POSITIONS.indexOf(a.position) - DUTY_IMPORT_POSITIONS.indexOf(b.position));
  return { month: currentMonth, rows: assignments };
}

export async function readDutyRosterWorkbook(buffer) {
  const rows = await readXlsxFile(buffer);
  return parseDutyRosterWorkbook({ sheets: [{ name: "Sheet1", rows }] });
}
