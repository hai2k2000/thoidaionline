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
  .replace(/[\u0300-\u036f]/g, "").replace(/[Ä‘Ä]/g, "d").toLowerCase()
  .replace(/[^a-z0-9]+/g, " ").trim();
const normalizedValue = (value) => normalizeExcelText(value).normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[Ä‘Ä]/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
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
  const result = map.get(text); if (!result) throw new DepartmentPlanExcelValidationError(`DÃ²ng ${rowNumber}: ${label} khÃ´ng há»£p lá»‡: ${cellText(value)}.`, { row: rowNumber, field: label }); return result;
};
const parsePeriodType = (value, fallback, rowNumber) => {
  const text = normalizedValue(value); if (!text) return fallback ?? null;
  const result = PERIOD_TYPES.get(text); if (!result) throw new DepartmentPlanExcelValidationError(`DÃ²ng ${rowNumber}: Loáº¡i ká»³ khÃ´ng há»£p lá»‡: ${cellText(value)}.`, { row: rowNumber, field: "Loáº¡i ká»³" }); return result;
};
const rowValue = (row, lookup, key) => lookup.has(key) ? row[lookup.get(key)] : null;
const optionalDate = (value, rowNumber, label) => {
  if (value == null || cellText(value) === "") return null;
  const parsed = parseDepartmentPlanExcelDate(value); if (!parsed) throw new DepartmentPlanExcelValidationError(`DÃ²ng ${rowNumber}: ${label} khÃ´ng há»£p lá»‡.`, { row: rowNumber, field: label }); return parsed;
};

export function parseDepartmentPlanExcelRows(rows, context = {}) {
  const header = headerForRows(rows); if (!header) throw new Error("KhÃ´ng tÃ¬m tháº¥y sheet dá»¯ liá»‡u káº¿ hoáº¡ch há»£p lá»‡.");
  const parsed = [];
  for (let index = header.rowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? []; if (!row.map(cellText).some(Boolean)) continue;
    const rowNumber = index + 1;
    const title = cellText(rowValue(row, header.lookup, "title"));
    if (!title) throw new DepartmentPlanExcelValidationError(`DÃ²ng ${rowNumber}: thiáº¿u TÃªn cÃ´ng viá»‡c.`, { row: rowNumber, field: "TÃªn cÃ´ng viá»‡c" });
    const periodType = parsePeriodType(rowValue(row, header.lookup, "periodType"), context.periodType ?? null, rowNumber);
    // The open Plan owns the reporting window. Row-level period columns are
    // legacy metadata and must not override or be compared with that Plan.
    const periodStart = context.periodStart ?? optionalDate(rowValue(row, header.lookup, "periodStart"), rowNumber, "Tá»« ngÃ y");
    const periodEnd = context.periodEnd ?? optionalDate(rowValue(row, header.lookup, "periodEnd"), rowNumber, "Äáº¿n ngÃ y");
    if (!periodType || !periodStart || !periodEnd) throw new DepartmentPlanExcelValidationError(`DÃ²ng ${rowNumber}: thiáº¿u thÃ´ng tin ká»³.`, { row: rowNumber, field: "Loáº¡i ká»³" });
    if (context.periodType && periodType !== context.periodType) throw new DepartmentPlanExcelValidationError(`DÃ²ng ${rowNumber}: loáº¡i ká»³ khÃ´ng khá»›p ká»³ Ä‘ang má»Ÿ.`, { row: rowNumber, field: "Loáº¡i ká»³" });
    const taskId = cellText(rowValue(row, header.lookup, "taskId")); if (taskId && !UUID_PATTERN.test(taskId)) throw new DepartmentPlanExcelValidationError(`DÃ²ng ${rowNumber}: Task ID liÃªn káº¿t khÃ´ng há»£p lá»‡.`, { row: rowNumber, field: "Task ID liÃªn káº¿t" });
    const confirmation = normalizedValue(rowValue(row, header.lookup, "confirmationRequired"));
    const periodRelation = parseEnum(rowValue(row, header.lookup, "periodRelation"), PERIOD_RELATIONS, "Quan há»‡ vá»›i ká»³", rowNumber) ?? "IMPORTED";
    const startDate = optionalDate(rowValue(row, header.lookup, "startDate"), rowNumber, "NgÃ y báº¯t Ä‘áº§u");
    if (periodRelation === "NEW" && startDate && context.periodStart && context.periodEnd
      && (startDate < context.periodStart || startDate > context.periodEnd)) {
      throw new DepartmentPlanExcelValidationError(`DÃ²ng ${rowNumber}: NgÃ y báº¯t Ä‘áº§u cá»§a cÃ´ng viá»‡c má»›i pháº£i náº±m trong ká»³ Ä‘ang má»Ÿ.`, { row: rowNumber, field: "NgÃ y báº¯t Ä‘áº§u" });
    }
    parsed.push({ rowNumber, title, description: cellText(rowValue(row, header.lookup, "description")) || null,
      departmentName: cellText(rowValue(row, header.lookup, "department")) || null, periodType, periodStart, periodEnd,
      startDate, dueDate: optionalDate(rowValue(row, header.lookup, "dueDate"), rowNumber, "Háº¡n hoÃ n thÃ nh cuá»‘i"),
      reportDate: optionalDate(rowValue(row, header.lookup, "reportDate"), rowNumber, "NgÃ y bÃ¡o cÃ¡o"), milestone: optionalDate(rowValue(row, header.lookup, "milestone"), rowNumber, "Má»‘c trong ká»³"),
      priority: parseEnum(rowValue(row, header.lookup, "priority"), PRIORITIES, "Má»©c Æ°u tiÃªn", rowNumber), status: parseEnum(rowValue(row, header.lookup, "status"), STATUSES, "Tráº¡ng thÃ¡i", rowNumber),
      periodRelation,
      workSource: parseEnum(rowValue(row, header.lookup, "workSource"), WORK_SOURCES, "Nguá»“n cÃ´ng viá»‡c", rowNumber) ?? "department_plan", taskId: taskId || null,
      assigneeNames: splitPeople(rowValue(row, header.lookup, "assignees")), collaboratorNames: splitPeople(rowValue(row, header.lookup, "collaborators")),
      confirmationRequired: ["co", "yes", "true", "1", "bat buoc"].includes(confirmation), note: cellText(rowValue(row, header.lookup, "note")) || null });
  }
  if (!parsed.length) throw new Error("File Excel khÃ´ng cÃ³ dÃ²ng cÃ´ng viá»‡c há»£p lá»‡."); return parsed;
}
export const deduplicateDepartmentPlanExcelRows = (rows) => {
  const seen = new Map();
  return rows.map((row, index) => {
    const title = normalizedValue(row.title);
    const key = row.taskId ? `task:${row.taskId}:${row.periodType}:${row.periodStart}` : `title:${title}:${row.periodType}:${row.periodStart}`;
    const duplicateOf = seen.get(key) ?? null;
    if (!duplicateOf) seen.set(key, row.rowNumber ?? index + 1);
    return duplicateOf ? { ...row, duplicateOf, duplicateType: row.taskId ? "TASK_ID" : "TITLE" } : row;
  });
};
export async function readDepartmentPlanExcel(file, context = {}) {
  if (!(file instanceof File)) throw new Error("File Excel khÃ´ng há»£p lá»‡.");
  if (!file.name.toLowerCase().endsWith(".xlsx") || file.size < 1 || file.size > MAX_FILE_BYTES) throw new Error("File Excel khÃ´ng há»£p lá»‡: chá»‰ há»— trá»£ .xlsx tá»‘i Ä‘a 10 MB.");
  const buffer = Buffer.from(await file.arrayBuffer()); const names = await readSheetNames(buffer); const candidates = [];
  for (const name of names) { if (sheetIsInstructional(name)) continue; const rows = await readXlsxFile(buffer, { sheet: name, trim: false }); if (headerForRows(rows)) candidates.push({ name, rows }); }
  const preferred = candidates.find((sheet) => normalizeExcelHeader(sheet.name) === "kehoach import");
  if (!preferred && candidates.length !== 1) throw new Error("File Excel khÃ´ng há»£p lá»‡: cáº§n má»™t sheet dá»¯ liá»‡u káº¿ hoáº¡ch duy nháº¥t.");
  const rows = parseDepartmentPlanExcelRows((preferred ?? candidates[0]).rows, context);
  return context.preserveDuplicates ? rows : deduplicateDepartmentPlanExcelRows(rows);
}
