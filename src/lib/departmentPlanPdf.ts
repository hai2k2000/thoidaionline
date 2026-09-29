import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type {
  DepartmentPlanReportFilters,
  DepartmentPlanReportMetrics,
} from "./departmentPlanReport";
import type { DepartmentPlanReportResult } from "./departmentPlanReportRepository";
import type { DepartmentPlanItemRow } from "./departmentPlanRepository";

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FONT_PATH = join(process.cwd(), "public", "fonts", "DejaVuSans.ttf");
const BOLD_FONT_PATH = join(process.cwd(), "public", "fonts", "DejaVuSans-Bold.ttf");

const statusLabels: Record<DepartmentPlanItemRow["work_status"], string> = {
  planned: "Kế hoạch / Chưa bắt đầu",
  in_progress: "Đang thực hiện",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

const assignmentLabels: Record<DepartmentPlanItemRow["assignment_state"], string> = {
  unassigned: "Chưa phân công",
  department_wide: "Cả phòng",
  assigned: "Đã phân công",
};

const metricLabels: Array<[keyof DepartmentPlanReportMetrics, string]> = [
  ["total", "Tổng công việc"],
  ["completed", "Hoàn thành"],
  ["inProgress", "Đang thực hiện"],
  ["planned", "Kế hoạch"],
  ["overdue", "Quá hạn"],
  ["unassigned", "Chưa phân công"],
  ["departmentWide", "Cả phòng"],
];

export type DepartmentPlanPdfModel = {
  departmentName: string;
  periodLabel: string;
  periodModeLabel: string;
  generatedAtLabel: string;
  filtersLabel: string;
  metrics: DepartmentPlanReportMetrics;
  items: DepartmentPlanReportResult["items"];
  filename: string;
};

export type DepartmentPlanPdfOutput = {
  bytes: Uint8Array;
  filename: string;
  pageCount: number;
};

const cleanText = (value: string) => value
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
  .replace(/\t/g, " ")
  .trim();

export const departmentPlanPdfFilename = (
  periodType: "weekly" | "monthly",
  periodStart: string,
) => `bao-cao-ke-hoach-phong-${periodType === "weekly" ? "tuan" : "thang"}-${periodStart}.pdf`;

export function buildDepartmentPlanPdfModel({
  departmentName,
  periodLabel,
  report,
  filters,
  generatedAt = new Date(),
}: {
  departmentName: string;
  periodLabel: string;
  report: DepartmentPlanReportResult;
  filters: DepartmentPlanReportFilters;
  generatedAt?: Date;
}): DepartmentPlanPdfModel {
  const employeeName = filters.employeeId
    ? report.employees.find((employee) => employee.id === filters.employeeId)?.full_name ?? "Không hợp lệ"
    : null;
  const activeFilters = [
    employeeName ? `Nhân viên: ${employeeName}` : null,
    filters.workStatus ? `Trạng thái: ${statusLabels[filters.workStatus]}` : null,
    filters.assignmentState ? `Phân công: ${assignmentLabels[filters.assignmentState]}` : null,
  ].filter((value): value is string => Boolean(value));

  return {
    departmentName: cleanText(departmentName) || "Phòng ban được cấp quyền",
    periodLabel: cleanText(periodLabel),
    periodModeLabel: report.period.periodType === "weekly" ? "Báo cáo tuần" : "Báo cáo tháng",
    generatedAtLabel: new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      dateStyle: "short",
      timeStyle: "short",
    }).format(generatedAt),
    filtersLabel: activeFilters.length ? activeFilters.join(" | ") : "Bộ lọc: Tất cả",
    metrics: report.metrics,
    items: report.items,
    filename: departmentPlanPdfFilename(report.period.periodType, report.period.periodStart),
  };
}

const formatDueDate = (value: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
};

const supportedText = (value: string, characterSet: Set<number>) => Array.from(cleanText(value), (character) =>
  characterSet.has(character.codePointAt(0) ?? 0) ? character : "?").join("");

const wrapText = (
  rawValue: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
  characterSet: Set<number>,
) => {
  const value = supportedText(rawValue || "—", characterSet);
  const paragraphs = value.split(/\r?\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
        line = word;
        continue;
      }
      let fragment = "";
      for (const character of Array.from(word)) {
        const next = fragment + character;
        if (fragment && font.widthOfTextAtSize(next, fontSize) > maxWidth) {
          lines.push(fragment);
          fragment = character;
        } else {
          fragment = next;
        }
      }
      line = fragment;
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : ["—"];
};

const drawTextLines = ({
  page,
  lines,
  font,
  fontSize,
  x,
  top,
  lineHeight,
  color = rgb(0.15, 0.18, 0.24),
}: {
  page: PDFPage;
  lines: string[];
  font: PDFFont;
  fontSize: number;
  x: number;
  top: number;
  lineHeight: number;
  color?: ReturnType<typeof rgb>;
}) => {
  lines.forEach((line, index) => page.drawText(line || " ", {
    x,
    y: top - fontSize - index * lineHeight,
    size: fontSize,
    font,
    color,
  }));
};

const drawPageHeader = ({
  page,
  model,
  font,
  boldFont,
}: {
  page: PDFPage;
  model: DepartmentPlanPdfModel;
  font: PDFFont;
  boldFont: PDFFont;
}) => {
  page.drawText("TẠP CHÍ THỜI ĐẠI", { x: MARGIN, y: PAGE_HEIGHT - 42, size: 9, font: boldFont, color: rgb(0.18, 0.25, 0.42) });
  page.drawText("KẾ HOẠCH CÔNG VIỆC PHÒNG/BAN", { x: MARGIN, y: PAGE_HEIGHT - 65, size: 16, font: boldFont, color: rgb(0.08, 0.12, 0.22) });
  page.drawText(model.departmentName, { x: MARGIN, y: PAGE_HEIGHT - 83, size: 9.5, font: boldFont, color: rgb(0.18, 0.25, 0.42) });
  page.drawText(`${model.periodModeLabel}: ${model.periodLabel}`, { x: MARGIN, y: PAGE_HEIGHT - 99, size: 8.5, font, color: rgb(0.28, 0.32, 0.4) });
  const generated = `Xuất lúc: ${model.generatedAtLabel}`;
  page.drawText(generated, {
    x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(generated, 7.5),
    y: PAGE_HEIGHT - 42,
    size: 7.5,
    font,
    color: rgb(0.38, 0.42, 0.5),
  });
};

const drawSummary = ({
  page,
  model,
  font,
  boldFont,
  characterSet,
  top,
}: {
  page: PDFPage;
  model: DepartmentPlanPdfModel;
  font: PDFFont;
  boldFont: PDFFont;
  characterSet: Set<number>;
  top: number;
}) => {
  const gap = 5;
  const cardWidth = (CONTENT_WIDTH - gap * 6) / 7;
  const cardHeight = 39;
  metricLabels.forEach(([key, label], index) => {
    const x = MARGIN + index * (cardWidth + gap);
    page.drawRectangle({ x, y: top - cardHeight, width: cardWidth, height: cardHeight, color: rgb(0.955, 0.965, 0.985), borderColor: rgb(0.82, 0.85, 0.92), borderWidth: 0.6 });
    const labelLines = wrapText(label, font, 6.5, cardWidth - 10, characterSet).slice(0, 2);
    drawTextLines({ page, lines: labelLines, font, fontSize: 6.5, x: x + 5, top: top - 4, lineHeight: 8, color: rgb(0.32, 0.37, 0.48) });
    page.drawText(String(model.metrics[key]), { x: x + 5, y: top - 31, size: 13, font: boldFont, color: rgb(0.12, 0.18, 0.34) });
  });
  return top - cardHeight;
};

type Column = { key: "stt" | "title" | "assignee" | "due" | "status" | "assignment"; label: string; width: number };

const columns: Column[] = [
  { key: "stt", label: "STT", width: 34 },
  { key: "title", label: "Nội dung công việc", width: 293 },
  { key: "assignee", label: "Người thực hiện", width: 122 },
  { key: "due", label: "Hạn hoàn thành", width: 88 },
  { key: "status", label: "Trạng thái", width: 116 },
  { key: "assignment", label: "Phân công", width: 116 },
];

const drawTableHeader = (page: PDFPage, boldFont: PDFFont, y: number) => {
  const height = 24;
  page.drawRectangle({ x: MARGIN, y: y - height, width: CONTENT_WIDTH, height, color: rgb(0.18, 0.25, 0.42) });
  let x = MARGIN;
  for (const column of columns) {
    page.drawText(column.label, { x: x + 5, y: y - 16, size: 7.2, font: boldFont, color: rgb(1, 1, 1) });
    x += column.width;
  }
  return y - height;
};

const rowValues = (model: DepartmentPlanPdfModel, index: number) => {
  const item = model.items[index];
  return {
    stt: String(index + 1),
    title: item.title,
    assignee: item.assignee_name ?? "—",
    due: formatDueDate(item.due_at),
    status: statusLabels[item.work_status],
    assignment: assignmentLabels[item.assignment_state],
  };
};

export async function renderDepartmentPlanPdf(
  model: DepartmentPlanPdfModel,
  options: { fontBytes?: Uint8Array; boldFontBytes?: Uint8Array } = {},
): Promise<DepartmentPlanPdfOutput> {
  const [fontBytes, boldFontBytes] = await Promise.all([
    options.fontBytes ?? readFile(FONT_PATH),
    options.boldFontBytes ?? readFile(BOLD_FONT_PATH),
  ]);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const boldFont = await pdf.embedFont(boldFontBytes, { subset: true });
  const characterSet = new Set(font.getCharacterSet());
  pdf.setTitle("Báo cáo kế hoạch công việc phòng/ban");
  pdf.setAuthor("Tạp chí Thời Đại");
  pdf.setSubject(`${model.departmentName} - ${model.periodLabel}`);
  pdf.setCreator("Thời Đại Work");

  const pages: PDFPage[] = [];
  const addPage = (continued: boolean) => {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    drawPageHeader({ page, model, font, boldFont });
    let y = PAGE_HEIGHT - 118;
    if (!continued) {
      y = drawSummary({ page, model, font, boldFont, characterSet, top: y });
      const filterLines = wrapText(model.filtersLabel, font, 7.5, CONTENT_WIDTH, characterSet).slice(0, 2);
      drawTextLines({ page, lines: filterLines, font, fontSize: 7.5, x: MARGIN, top: y - 8, lineHeight: 10, color: rgb(0.28, 0.32, 0.4) });
      y -= 14 + filterLines.length * 10;
    } else {
      page.drawText("Danh sách công việc (tiếp)", { x: MARGIN, y: y - 9, size: 8, font: boldFont, color: rgb(0.28, 0.32, 0.4) });
      y -= 18;
    }
    return { page, y: drawTableHeader(page, boldFont, y) };
  };

  let state = addPage(false);
  if (!model.items.length) {
    state.page.drawRectangle({ x: MARGIN, y: state.y - 54, width: CONTENT_WIDTH, height: 54, borderColor: rgb(0.82, 0.85, 0.9), borderWidth: 0.6 });
    state.page.drawText("Không có công việc trong phạm vi báo cáo.", {
      x: MARGIN + 10,
      y: state.y - 31,
      size: 9,
      font,
      color: rgb(0.35, 0.4, 0.48),
    });
  } else {
    for (let index = 0; index < model.items.length; index += 1) {
      const values = rowValues(model, index);
      const wrapped = columns.map((column) => wrapText(values[column.key], font, 7.3, column.width - 10, characterSet));
      const rowHeight = Math.max(26, Math.max(...wrapped.map((lines) => lines.length)) * 9 + 10);
      if (state.y - rowHeight < 35) state = addPage(true);
      const fill = index % 2 === 0 ? rgb(0.985, 0.988, 0.995) : rgb(1, 1, 1);
      state.page.drawRectangle({ x: MARGIN, y: state.y - rowHeight, width: CONTENT_WIDTH, height: rowHeight, color: fill, borderColor: rgb(0.86, 0.88, 0.92), borderWidth: 0.45 });
      let x = MARGIN;
      columns.forEach((column, columnIndex) => {
        if (columnIndex > 0) state.page.drawLine({ start: { x, y: state.y }, end: { x, y: state.y - rowHeight }, thickness: 0.35, color: rgb(0.88, 0.9, 0.93) });
        drawTextLines({ page: state.page, lines: wrapped[columnIndex], font, fontSize: 7.3, x: x + 5, top: state.y - 5, lineHeight: 9 });
        x += column.width;
      });
      state.y -= rowHeight;
    }
  }

  pages.forEach((page, index) => {
    const footer = `Trang ${index + 1}/${pages.length}`;
    page.drawText(footer, {
      x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(footer, 7),
      y: 18,
      size: 7,
      font,
      color: rgb(0.42, 0.45, 0.52),
    });
  });

  return {
    bytes: await pdf.save(),
    filename: model.filename,
    pageCount: pages.length,
  };
}
