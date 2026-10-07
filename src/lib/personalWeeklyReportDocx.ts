import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { PersonalWeeklyReportLoad } from "@/lib/personalWeeklyReportRepository";

const FONT = "Times New Roman";
const text = (value: string, bold = false) => new TextRun({ text: value || "-", font: FONT, size: 20, bold });
const paragraph = (value: string, bold = false, alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]) => new Paragraph({ alignment, spacing: { after: 100 }, children: [text(value, bold)] });
const value = (row: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null && row[key] !== "") return String(row[key]);
  return "-";
};
const cell = (content: string, bold = false) => new TableCell({ width: { size: 2600, type: WidthType.DXA }, children: [new Paragraph({ children: [text(content, bold)] })] });
const row = (item: Record<string, unknown>, index: number) => new TableRow({ children: [cell(String(index + 1)), cell(value(item, "title", "taskTitle")), cell(value(item, "sourceLabel", "source")), cell(value(item, "status")), cell(value(item, "resultText", "commentary", "notes"))] });
const rowsTable = (items: Record<string, unknown>[], headers: string[]) => new Table({ width: { size: 13000, type: WidthType.DXA }, rows: [new TableRow({ tableHeader: true, children: headers.map((header) => cell(header, true)) }), ...items.map(row)] });
const safeFilenamePart = (input: string) => input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_") || "Nhan_vien";

export function personalWeeklyReportDocxFilename(employeeName: string, period: { start: string; end: string }) {
  return `Bao_cao_tuan_${safeFilenamePart(employeeName)}_${period.start}_${period.end}.docx`;
}

export async function exportPersonalWeeklyReportDocx(viewModel: PersonalWeeklyReportLoad) {
  const employee = viewModel.employee ?? {};
  const employeeName = value(employee, "full_name", "name");
  const department = typeof employee.departments === "object" && employee.departments !== null && !Array.isArray(employee.departments)
    ? value(employee.departments as Record<string, unknown>, "name")
    : value(employee, "department_name");
  const currentRows = viewModel.currentRows as Record<string, unknown>[];
  const nextRows = viewModel.nextRows as Record<string, unknown>[];
  const proposals = viewModel.proposals as Record<string, unknown>[];
  const period = viewModel.period.current;
  const children = [
    paragraph("BÁO CÁO TUẦN", true, AlignmentType.CENTER),
    paragraph(`Nhân viên: ${employeeName}`),
    paragraph(`Phòng ban: ${department}`),
    paragraph(`Kỳ báo cáo: ${period.start} - ${period.end}`),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [text("I. Kết quả công việc trong tuần", true)] }),
    paragraph(`Tổng số công việc: ${currentRows.length}`),
    ...(currentRows.length ? [rowsTable(currentRows, ["STT", "Công việc", "Nguồn", "Trạng thái", "Kết quả / ghi chú"])] : [paragraph("Không có công việc trong kỳ.")]),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [text("II. Kế hoạch tuần tới", true)] }),
    paragraph(`Tổng số công việc kế hoạch: ${nextRows.length}`),
    ...(nextRows.length ? [rowsTable(nextRows, ["STT", "Công việc", "Nguồn", "Trạng thái", "Kết quả / ghi chú"])] : [paragraph("Không có công việc kế hoạch cho tuần tới.")]),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [text("III. Khó khăn, kiến nghị", true)] }),
    paragraph(`Khó khăn / kiến nghị: ${viewModel.difficulties || "Không có"}`),
    paragraph(`Tổng số đề xuất: ${proposals.length}`),
    ...(proposals.length ? proposals.map((proposal, index) => paragraph(`${index + 1}. ${value(proposal, "title", "name", "description")}`)) : []),
  ];
  const document = new Document({ title: "Báo cáo tuần", creator: "Thời Đại Work", styles: { default: { document: { run: { font: FONT, size: 20 } } } }, sections: [{ children }] });
  return Packer.toBuffer(document);
}
