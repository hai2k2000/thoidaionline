import { AlignmentType, BorderStyle, Document, Footer, Packer, Paragraph, SimpleField, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { classifyTaskDeadline } from "./deadlineClassification.mjs";
import { formatDateOnlyVN } from "./businessDate.mjs";
import { resolveDisplayedAssigner } from "./taskAssignmentDisplay.mjs";
import type { TaskListItemDto } from "./taskContracts";

type ReportTask = Partial<TaskListItemDto> & { title: string; status: string };
const FONT = "Times New Roman";
const SIZE = 22;
const run = (value: unknown, bold = false) => new TextRun({ text: String(value ?? ""), font: FONT, size: SIZE, bold });
const para = (value: unknown = "", options: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number } = {}) =>
  new Paragraph({ alignment: options.align, spacing: { before: options.before ?? 0, after: options.after ?? 80, line: 276 }, children: [run(value, options.bold)] });
const date = (value?: string | null) => value ? formatDateOnlyVN(value.slice(0, 10)) : "—";
const cell = (value: unknown, bold = false) => new TableCell({ children: [para(value, { bold, after: 20 })] });
const statusLabels: Record<string, string> = { done: "Đã hoàn thành", new: "Mới", in_progress: "Đang thực hiện", waiting: "Chờ duyệt giao việc", pending_review: "Chờ duyệt hoàn thành", blocked: "Vướng mắc", rejected: "Trả lại", cancelled: "Đã hủy" };

function headerCell(children: Paragraph[], width: number) {
  const border = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return new TableCell({ width: { size: width, type: WidthType.DXA }, borders: { top: border, bottom: border, left: border, right: border }, children });
}
function assignees(task: ReportTask) {
  return [...new Set((task.task_assignees ?? []).filter(person => ["owner", "assignee"].includes(person.assignment_role)).map(person => person.staff_users?.full_name).filter(Boolean))].join(", ") || "Chưa phân công";
}
function section(title: string, items: ReportTask[], group: boolean) {
  const groups = new Map<string, ReportTask[]>();
  for (const task of items) {
    const key = group ? assignees(task) : "";
    groups.set(key, [...(groups.get(key) ?? []), task]);
  }
  let index = 0;
  const rows = [new TableRow({ tableHeader: true, children: ["STT", "Công việc", "Người thực hiện", "Người giao", "Hạn", "Trạng thái/Ghi chú"].map(value => cell(value, true)) })];
  for (const [name, tasks] of [...groups].sort(([a], [b]) => a.localeCompare(b, "vi"))) {
    if (name) rows.push(new TableRow({ children: [new TableCell({ columnSpan: 6, children: [para("Người thực hiện: " + name, { bold: true })] })] }));
    for (const task of tasks) {
      const completion = task.completed_at ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(task.completed_at)) : "";
      const note = task.status === "done" ? completion : task.report_notes ?? "";
      rows.push(new TableRow({ cantSplit: true, children: [
        cell(++index), cell(task.title + (task.project?.name ? " [" + task.project.name + "]" : "")),
        cell(assignees(task)), cell(resolveDisplayedAssigner(task).value), cell(date(task.due_date) + (task.due_time ? " " + task.due_time.slice(0, 5) : "")),
        cell((statusLabels[task.status] ?? task.status) + (note ? " · " + note : "")),
      ] }));
    }
  }
  if (!items.length) rows.push(new TableRow({ children: [new TableCell({ columnSpan: 6, children: [para("Không có công việc.")] })] }));
  return [para(title, { bold: true, before: 160 }), new Table({ width: { size: 9500, type: WidthType.DXA }, columnWidths: [450, 2600, 1500, 1500, 1150, 2300], rows })];
}

export async function exportTaskListReportDocx(input: { tasks: ReportTask[]; from: string; to: string; userName: string; filterLabel: string; now?: Date }) {
  const { tasks } = input;
  const completed = tasks.filter(task => task.status === "done");
  const active = tasks.filter(task => !["done", "cancelled"].includes(task.status));
  const overdue = active.filter(task => classifyTaskDeadline({ ...task, due_date: task.due_date ?? null }, input.now ?? new Date()) === "overdue");
  const cancelled = tasks.filter(task => task.status === "cancelled");
  const group = new Set(tasks.map(assignees)).size > 1;
  const content: Array<Paragraph | Table> = [
    new Table({ width: { size: 9500, type: WidthType.DXA }, rows: [new TableRow({ children: [
      headerCell([para("TẠP CHÍ THỜI ĐẠI", { bold: true, align: AlignmentType.CENTER })], 4300),
      headerCell([para("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { bold: true, align: AlignmentType.CENTER }), para("Độc lập - Tự do - Hạnh phúc", { align: AlignmentType.CENTER })], 5200),
    ] })] }),
    para("BÁO CÁO CÔNG VIỆC", { bold: true, align: AlignmentType.CENTER, before: 240 }),
    para("Từ ngày " + date(input.from) + " đến ngày " + date(input.to), { align: AlignmentType.CENTER }),
    para("Bộ lọc: " + input.filterLabel),
    para("Tổng: " + tasks.length + " · Đã hoàn thành: " + completed.length + " · Đang thực hiện: " + active.length + " · Quá hạn: " + overdue.length + " · Chưa có hạn: " + tasks.filter(task => !task.due_date).length, { bold: true }),
    ...section("I. Đã hoàn thành", completed, group),
    ...section("II. Đang thực hiện", active.filter(task => !overdue.includes(task)), group),
    ...section("III. Quá hạn", overdue, group),
    ...(cancelled.length ? section("IV. Đã hủy", cancelled, group) : []),
    para("NGƯỜI LẬP", { bold: true, align: AlignmentType.CENTER, before: 420, after: 220 }),
    para(input.userName, { align: AlignmentType.CENTER }),
  ];
  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Báo cáo công việc - dùng nội bộ  -  "), new SimpleField("PAGE", "1")] })] });
  return Packer.toBuffer(new Document({ title: "Báo cáo công việc", creator: "Thời Đại Work", styles: { default: { document: { run: { font: FONT, size: SIZE } } } }, sections: [{ properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } }, footers: { default: footer }, children: content }] }));
}

export function taskListReportDocxFilename(from: string, to: string) {
  return "Bao_cao_cong_viec_" + from + "_" + to + ".docx";
}
