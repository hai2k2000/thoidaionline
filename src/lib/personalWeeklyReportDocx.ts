import { AlignmentType, BorderStyle, Document, Footer, Packer, Paragraph, SimpleField, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import type { PersonalWeeklyReportLoad } from "@/lib/personalWeeklyReportRepository";
import { formatDateOnlyVN } from "@/lib/businessDate.mjs";

const FONT = "Times New Roman";
const SIZE = 22;
const empty = (value: unknown) => value === undefined || value === null || String(value).trim() === "" ? "" : String(value);
const run = (value: unknown, bold = false) => new TextRun({ text: empty(value), font: FONT, size: SIZE, bold });
const para = (value: unknown = "", options: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number; indent?: number } = {}) => new Paragraph({ alignment: options.align, spacing: { before: options.before ?? 0, after: options.after ?? 100, line: 276 }, indent: options.indent ? { left: options.indent } : undefined, children: [run(value, options.bold)] });
const date = (value: unknown) => { const raw = empty(value); return raw ? formatDateOnlyVN(raw.slice(0, 10)) : ""; };
const value = (row: Record<string, unknown>, ...keys: string[]) => keys.map((key) => row[key]).find((item) => item !== undefined && item !== null && String(item).trim() !== "");
const safeFilenamePart = (input: string) => input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_") || "Nhan_vien";

export function personalWeeklyReportDocxFilename(employeeName: string, period: { start: string; end: string }) { return `Ke_hoach_cong_tac_tuan_${safeFilenamePart(employeeName)}_${period.start}_${period.end}.docx`; }
function borderlessCell(children: Paragraph[], width: number) { return new TableCell({ width: { size: width, type: WidthType.DXA }, borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }, children }); }
function workItem(item: Record<string, unknown>, index: number) { const children = [para(`${index}. ${value(item, "title", "taskTitle") ?? "Công việc"}`, { bold: true, after: 60 })]; const result = value(item, "resultText", "commentary", "periodCommentary", "notes"); const note = value(item, "resultNote", "additionalNote"); if (result) children.push(para(`- ${result}`, { indent: 360, after: 40 })); if (note) children.push(para(`- ${note}`, { indent: 360, after: 80 })); return children; }

export async function exportPersonalWeeklyReportDocx(viewModel: PersonalWeeklyReportLoad) {
  const employee = viewModel.employee ?? {};
  const employeeName = empty(value(employee, "full_name", "name"));
  const department = empty(value(employee, "department_name")) || empty((employee.departments as Record<string, unknown> | null)?.name);
  const position = empty(value(employee, "job_title_name", "position", "title")) || empty((employee.job_titles as Record<string, unknown> | null)?.name);
  const currentRows = viewModel.currentRows as Record<string, unknown>[];
  const nextRows = viewModel.nextRows as Record<string, unknown>[];
  const proposals = viewModel.proposals as Record<string, unknown>[];
  const period = viewModel.period.current;
  const nextPeriod = viewModel.period.next;
  const externalWork = empty(value(employee, "external_work", "outside_work"));
  const leave = empty(value(employee, "leave_period", "leave"));
  const content: Array<Paragraph | Table> = [];
  content.push(new Table({ width: { size: 9500, type: WidthType.DXA }, rows: [new TableRow({ children: [borderlessCell([para("TẠP CHÍ THỜI ĐẠI", { bold: true, align: AlignmentType.CENTER, after: 40 }), para(department, { align: AlignmentType.CENTER })], 4300), borderlessCell([para("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { bold: true, align: AlignmentType.CENTER, after: 40 }), para("Độc lập - Tự do - Hạnh phúc", { align: AlignmentType.CENTER })], 5200)] })] }));
  content.push(para("KẾ HOẠCH CÔNG TÁC TUẦN", { bold: true, align: AlignmentType.CENTER, before: 240, after: 40 }));
  content.push(para("-----", { align: AlignmentType.CENTER, after: 180 }));
  content.push(para("I. Thông tin chung và thời gian làm việc/vắng mặt", { bold: true, after: 120 }));
  content.push(para(`Họ và tên: ${employeeName}`)); content.push(para(`Chức danh: ${position}`)); content.push(para(`Thời gian thực hiện báo cáo: Từ ngày ${date(period.start)} đến ngày ${date(period.end)}`)); content.push(para("Thời gian đi công tác/tác nghiệp bên ngoài:")); content.push(para(externalWork)); content.push(para("Thời gian xin nghỉ phép:")); content.push(para(leave));
  content.push(para(`II. Kết quả công tác (Từ ngày ${date(period.start)} đến ngày ${date(period.end)})`, { bold: true, before: 160, after: 120 })); if (currentRows.length) currentRows.forEach((item, index) => content.push(...workItem(item, index + 1))); else content.push(para("Không có công việc trong kỳ."));
  content.push(para(`III. Kế hoạch công tác (Từ ngày ${date(nextPeriod.start)} đến ngày ${date(nextPeriod.end)})`, { bold: true, before: 160, after: 120 })); if (nextRows.length) nextRows.forEach((item, index) => content.push(para(`${index + 1}. ${value(item, "title", "taskTitle") ?? "Công việc"}`, { after: 80 }))); else content.push(para("Không có kế hoạch công tác cho tuần tới.")); proposals.forEach((proposal, index) => content.push(para(`${nextRows.length + index + 1}. ${value(proposal, "title", "name", "description") ?? "Đề xuất"}`, { after: 80 })));
  content.push(para("IV. Kiến nghị/Đề xuất", { bold: true, before: 160, after: 120 })); content.push(para(viewModel.difficulties)); content.push(para("NGƯỜI LẬP", { bold: true, align: AlignmentType.CENTER, before: 420, after: 220 })); content.push(para(employeeName, { align: AlignmentType.CENTER }));
  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Biểu mẫu kế hoạch công tác tuần - dùng nội bộ"), run("  -  "), new SimpleField("PAGE", "1")] })] });
  const document = new Document({ title: "Kế hoạch công tác tuần", creator: "Thời Đại Work", styles: { default: { document: { run: { font: FONT, size: SIZE } } } }, sections: [{ properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } }, footers: { default: footer }, children: content }] });
  return Packer.toBuffer(document);
}
