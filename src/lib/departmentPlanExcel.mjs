import readXlsxFile, { readSheetNames } from "read-excel-file/node";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const HEADER_DEFINITIONS = [
  ["department", ["phong ban"]],
  ["periodType", ["loai ky"]],
  ["periodStart", ["tu ngay"]],
  ["periodEnd", ["den ngay"]],
  ["title", ["ten cong viec"]],
  ["description", ["noi dung yeu cau", "noi dung", "yeu cau"]],
  ["assignees", ["nguoi thuc hien"]],
  ["collaborators", ["nguoi phoi hop"]],
  ["startDate", ["ngay bat dau"]],
  ["milestone", ["moc trong ky"]],
  ["dueDate", ["han hoan thanh cuoi", "han hoan thanh"]],
  ["reportDate", ["ngay bao cao"]],
  ["priority", ["muc uu tien"]],
  ["status", ["trang thai"]],
  ["periodRelation", ["quan he voi ky"]],
  ["workSource", ["nguon cong viec"]],
  ["taskId", ["task id lien ket", "task id"]],
  ["confirmationRequired", ["yeu cau xac nhan"]],
  ["note", ["ghi chu"]],
];

const PERIOD_TYPES = new Map([
  ["tuan", "weekly"], ["tuan le", "weekly"], ["weekly", "weekly"],
  ["thang", "monthly"], ["monthly", "monthly"],
]);
const PRIORITIES = new Map([
  ["uu tien 1", "urgent"], ["uu tien 2", "high"], ["uu tien 3", "normal"],
  ["1", "urgent"], ["2", "high"], ["3", "normal"],
]);
const STATUSES = new Map([
  ["moi", "planned"], ["ke hoach", "planned"], ["chua bat dau", "planned"], ["planned", "planned"],
  ["dang thuc hien", "in_progress"], ["in progress", "in_progress"], ["in_progress", "in_progress"],
  ["hoan thanh", "completed"], ["completed", "completed"], ["done", "completed"],
  ["da huy", "cancelled"], ["cancelled", "cancelled"],
]);
const PERIOD_RELATIONS = new Map([
  ["moi", "NEW"], ["dai han", "LONG_RUNNING"], ["chuyen tiep", "CARRY_OVER"],
  ["dinh ky", "RECURRING"], ["phat sinh trong ky", "AUTO_ADDED_DURING_PERIOD"], ["import", "IMPORTED"],
]);
const WORK_SOURCES = new Map([
  ["lanh dao giao", "leadership_assigned"], ["leadership_assigned", "leadership_assigned"],
  ["tu nhan", "self_registered"], ["tu dang ky", "self_registered"], ["self_registered", "self_registered"],
  ["giao viec", "department_plan"], ["ke hoach phong", "department_plan"], ["department_plan", "department_plan"],
  ["import", "department_plan"], ["legacy_unknown", "legacy_unknown"],
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class DepartmentPlanExcelValidationError extends Error {
  constructor(message, { row, field } = {}) {
    super(message);
    this.name = "DepartmentPlanExcelValidationError";
    this.code = "INVALID_IMPORT_ROW";
    this.row = row ?? null;
    this.field = field ?? null;
  }
}

export const normalizeExcelText = (value) => String(value ?? "")
  .normalize("NFC").replace(/[\u00a0\r\n]+/g, " ").replace(/\s+/g, " ").trim();
export const normalizeExcelHeader = (value) => normalizeExcelText(value).normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase()
  .replace(/[^a-z0-9]+/g, " ").trim();
const normalizedValue = (value) => normalizeExcelText(value).normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
const cellText = (value) => normalizeExcelText(value);
const isoFromParts = (year, month, day) => {
  const candidate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = new Date(`${candidate}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== candidate ? null : candidate;
};
export const parseDepartmentPlanExcelDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return isoFromParts(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86400000));
    return isoFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  const text = cellText(value);
  let match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (match) return isoFromParts(Number(match[3]), Number(match[2]), Number(match[1]));
  match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (match) return isoFromParts(Number(match[1]), Number(match[2]), Number(match[3]));
  return null;
};
const splitPeople = (value) => cellText(value).split(";").map(cellText).filter(Boolean);
const sheetIsInstructional = (name) => /huong dan|vi du|example|readme|danh muc/i.test(normalizedValue(name));
const headerForRows = (rows) => {
  for (let index = 0; index < Math.min(rows.length, 30); index += 1) {
    const lookup = new Map();
    (rows[index] ?? []).forEach((value, column) => {
      const normalized = normalizeExcelHeader(value);
      for (const [key, aliases] of HEADER_DEFINITIONS) if (!lookup.has(key) && aliases.includes(normalized)) lookup.set(key, column);
    });
    if (lookup.has("title") && (lookup.has("periodType") || lookup.has("periodStart") || lookup.has("periodEnd"))) return { rowIndex: index, lookup };
  }
  return null;
};
const parseEnum = (value, map, label, rowNumber) => {
  const text = normalizedValue(value); if (!text) return null;
  const result = map.get(text); if (!result) throw new DepartmentPlanExcelValidationError(`Dòng ${rowNumber}: ${label} không hợp lệ: ${cellText(value)}.`, { row: rowNumber, field: label }); return result;
};
const parsePeriodType = (value, fallback, rowNumber) => {
  const text = normalizedValue(value); if (!text) return fallback ?? null;
  const result = PERIOD_TYPES.get(text); if (!result) throw new DepartmentPlanExcelValidationError(`Dòng ${rowNumber}: Loại kỳ không hợp lệ: ${cellText(value)}.`, { row: rowNumber, field: "Loại kỳ" }); return result;
};
const rowValue = (row, lookup, key) => lookup.has(key) ? row[lookup.get(key)] : null;
const optionalDate = (value, rowNumber, label) => {
  if (value == null || cellText(value) === "") return null;
  const parsed = parseDepartmentPlanExcelDate(value); if (!parsed) throw new DepartmentPlanExcelValidationError(`Dòng ${rowNumber}: ${label} không hợp lệ.`, { row: rowNumber, field: label }); return parsed;
};

export function parseDepartmentPlanExcelRows(rows, context = {}) {
  const header = headerForRows(rows); if (!header) throw new Error("Không tìm thấy sheet dữ liệu kế hoạch hợp lệ.");
  const parsed = [];
  for (let index = header.rowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? []; if (!row.map(cellText).some(Boolean)) continue;
    const rowNumber = index + 1;
    const title = cellText(rowValue(row, header.lookup, "title"));
    if (!title) throw new DepartmentPlanExcelValidationError(`Dòng ${rowNumber}: thiếu Tên công việc.`, { row: rowNumber, field: "Tên công việc" });
    const periodType = parsePeriodType(rowValue(row, header.lookup, "periodType"), context.periodType ?? null, rowNumber);
    const periodStart = optionalDate(rowValue(row, header.lookup, "periodStart"), rowNumber, "Từ ngày") ?? context.periodStart ?? null;
    const periodEnd = optionalDate(rowValue(row, header.lookup, "periodEnd"), rowNumber, "Đến ngày") ?? context.periodEnd ?? null;
    if (!periodType || !periodStart || !periodEnd) throw new DepartmentPlanExcelValidationError(`Dòng ${rowNumber}: thiếu thông tin kỳ.`, { row: rowNumber, field: "Loại kỳ" });
    if (context.periodType && periodType !== context.periodType) throw new DepartmentPlanExcelValidationError(`Dòng ${rowNumber}: loại kỳ không khớp kỳ đang mở.`, { row: rowNumber, field: "Loại kỳ" });
    if (context.periodStart && periodStart !== context.periodStart) throw new DepartmentPlanExcelValidationError(`Dòng ${rowNumber}: từ ngày không khớp kỳ đang mở.`, { row: rowNumber, field: "Từ ngày" });
    if (context.periodEnd && periodEnd !== context.periodEnd) throw new DepartmentPlanExcelValidationError(`Dòng ${rowNumber}: đến ngày không khớp kỳ đang mở.`, { row: rowNumber, field: "Đến ngày" });
    const taskId = cellText(rowValue(row, header.lookup, "taskId")); if (taskId && !UUID_PATTERN.test(taskId)) throw new DepartmentPlanExcelValidationError(`Dòng ${rowNumber}: Task ID liên kết không hợp lệ.`, { row: rowNumber, field: "Task ID liên kết" });
    const confirmation = normalizedValue(rowValue(row, header.lookup, "confirmationRequired"));
    parsed.push({ rowNumber, title, description: cellText(rowValue(row, header.lookup, "description")) || null,
      departmentName: cellText(rowValue(row, header.lookup, "department")) || null, periodType, periodStart, periodEnd,
      startDate: optionalDate(rowValue(row, header.lookup, "startDate"), rowNumber, "Ngày bắt đầu"), dueDate: optionalDate(rowValue(row, header.lookup, "dueDate"), rowNumber, "Hạn hoàn thành cuối"),
      reportDate: optionalDate(rowValue(row, header.lookup, "reportDate"), rowNumber, "Ngày báo cáo"), milestone: optionalDate(rowValue(row, header.lookup, "milestone"), rowNumber, "Mốc trong kỳ"),
      priority: parseEnum(rowValue(row, header.lookup, "priority"), PRIORITIES, "Mức ưu tiên", rowNumber), status: parseEnum(rowValue(row, header.lookup, "status"), STATUSES, "Trạng thái", rowNumber),
      periodRelation: parseEnum(rowValue(row, header.lookup, "periodRelation"), PERIOD_RELATIONS, "Quan hệ với kỳ", rowNumber) ?? "IMPORTED",
      workSource: parseEnum(rowValue(row, header.lookup, "workSource"), WORK_SOURCES, "Nguồn công việc", rowNumber) ?? "department_plan", taskId: taskId || null,
      assigneeNames: splitPeople(rowValue(row, header.lookup, "assignees")), collaboratorNames: splitPeople(rowValue(row, header.lookup, "collaborators")),
      confirmationRequired: ["co", "yes", "true", "1", "bat buoc"].includes(confirmation), note: cellText(rowValue(row, header.lookup, "note")) || null });
  }
  if (!parsed.length) throw new Error("File Excel không có dòng công việc hợp lệ."); return parsed;
}
export const deduplicateDepartmentPlanExcelRows = (rows) => {
  const seen = new Set(); return rows.filter((row) => { const title = normalizedValue(row.title); const key = row.taskId ? `task:${row.taskId}:${row.periodType}:${row.periodStart}` : `title:${title}:${row.periodType}:${row.periodStart}`; if (seen.has(key)) return false; seen.add(key); return true; });
};
export async function readDepartmentPlanExcel(file, context = {}) {
  if (!(file instanceof File)) throw new Error("File Excel không hợp lệ.");
  if (!file.name.toLowerCase().endsWith(".xlsx") || file.size < 1 || file.size > MAX_FILE_BYTES) throw new Error("File Excel không hợp lệ: chỉ hỗ trợ .xlsx tối đa 10 MB.");
  const buffer = Buffer.from(await file.arrayBuffer()); const names = await readSheetNames(buffer); const candidates = [];
  for (const name of names) { if (sheetIsInstructional(name)) continue; const rows = await readXlsxFile(buffer, { sheet: name, trim: false }); if (headerForRows(rows)) candidates.push({ name, rows }); }
  const preferred = candidates.find((sheet) => normalizeExcelHeader(sheet.name) === "kehoach import");
  if (!preferred && candidates.length !== 1) throw new Error("File Excel không hợp lệ: cần một sheet dữ liệu kế hoạch duy nhất.");
  return deduplicateDepartmentPlanExcelRows(parseDepartmentPlanExcelRows((preferred ?? candidates[0]).rows, context));
}
