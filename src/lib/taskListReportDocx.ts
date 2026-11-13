import { AlignmentType, BorderStyle, Document, Footer, Packer, Paragraph, SimpleField, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { buildTaskListReportModel, reportSummary } from "./taskListReport.mjs";
import type { NextWeekPlanModel, ReportSection, TaskListReportModel } from "./taskListReport.mjs";
import type { TaskListItemDto } from "./taskContracts";

type ReportTask = Partial<TaskListItemDto> & { title: string; status: string };
const FONT = "Times New Roman";
const SIZE = 22;
const run = (value: unknown, bold = false) => new TextRun({ text: String(value ?? ""), font: FONT, size: SIZE, bold });
const para = (value: unknown = "", options: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number } = {}) =>
  new Paragraph({ alignment: options.align, spacing: { before: options.before ?? 0, after: options.after ?? 80, line: 276 }, children: [run(value, options.bold)] });
const cell = (value: unknown, bold = false) => new TableCell({ children: [para(value, { bold, after: 20 })] });

function headerCell(children: Paragraph[], width: number) {
  const border = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return new TableCell({ width: { size: width, type: WidthType.DXA }, borders: { top: border, bottom: border, left: border, right: border }, children });
}
function section({ title, rows: tasks }: ReportSection) {
  const rows = [new TableRow({ tableHeader: true, children: ["STT", "Tên công việc", "Kết quả/Ghi chú"].map(value => cell(value, true)) })];
  tasks.forEach((task, index) => rows.push(new TableRow({ cantSplit: true, children: [cell(index + 1), cell(task.title), cell(task.statusNote)] })));
  if (!tasks.length) rows.push(new TableRow({ children: [new TableCell({ columnSpan: 3, children: [para("Không có công việc.")] })] }));
  return [para(title, { bold: true, before: 160 }), new Table({ width: { size: 9500, type: WidthType.DXA }, columnWidths: [500, 4200, 4800], rows })];
}

function planSection(plan: NextWeekPlanModel): Array<Paragraph | Table> {
  const planCell = (value: string) => new TableCell({ children: [new Paragraph({
    spacing: { after: 20, line: 276 },
    children: value.split(/\r\n|\r|\n/).map((text, index) => new TextRun({ text, font: FONT, size: SIZE, ...(index ? { break: 1 } : {}) })),
  })] });
  return [para(plan.title, { bold: true, before: 160 }), para(plan.periodLabel),
    plan.rows.length ? new Table({ width: { size: 9500, type: WidthType.DXA }, columnWidths: [450, 4800, 2700, 1550], rows: [
      new TableRow({ tableHeader: true, children: plan.headers.map(value => cell(value, true)) }),
      ...plan.rows.map(row => new TableRow({ cantSplit: true, children: row.map(planCell) })),
    ] }) : para(plan.emptyText)];
}

export async function exportTaskListReportDocx(source: TaskListReportModel | { tasks: ReportTask[]; from: string; to: string; userName: string; filterLabel: string; now?: Date }) {
  const input = "tasks" in source ? buildTaskListReportModel(source) : source;
  const content: Array<Paragraph | Table> = [
    new Table({ width: { size: 9500, type: WidthType.DXA }, rows: [new TableRow({ children: [
      headerCell([para("TẠP CHÍ THỜI ĐẠI", { bold: true, align: AlignmentType.CENTER })], 4300),
      headerCell([para("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { bold: true, align: AlignmentType.CENTER }), para("Độc lập - Tự do - Hạnh phúc", { align: AlignmentType.CENTER })], 5200),
    ] })] }),
    para("BÁO CÁO CÔNG VIỆC", { bold: true, align: AlignmentType.CENTER, before: 240 }),
    ...(input.filterLabel ? [para("Bộ lọc: " + input.filterLabel)] : []),
    para(reportSummary(input.counts), { bold: true }),
    para(input.generalInfo.title, { bold: true, before: 160 }),
    ...input.generalInfo.lines.map(line => para(line)),
    ...input.sections.flatMap(section),
    ...planSection(input.nextWeekPlan),
    para("NGƯỜI LẬP", { bold: true, align: AlignmentType.CENTER, before: 420, after: 220 }),
    para(input.userName, { align: AlignmentType.CENTER }),
  ];
  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Báo cáo công việc - dùng nội bộ  -  "), new SimpleField("PAGE", "1")] })] });
  return Packer.toBuffer(new Document({ title: "Báo cáo công việc", creator: "Thời Đại Work", styles: { default: { document: { run: { font: FONT, size: SIZE } } } }, sections: [{ properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } }, footers: { default: footer }, children: content }] }));
}

export function taskListReportDocxFilename(from: string, to: string) {
  return "Bao_cao_cong_viec_" + from + "_" + to + ".docx";
}
