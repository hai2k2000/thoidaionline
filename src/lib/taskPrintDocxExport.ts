import { AlignmentType, Document, PageBreak, Packer, Paragraph, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType } from "docx";
import JSZip from "jszip";

type WorkAssignmentPrintModel = {
  assignedDate: string; deadline: string; department: string; assignmentSourceLabel: string;
  assignerLabel: string; assigner: string; primaryAssignee: string; collaborators: string[];
  title: string; description: string; requirements: string[]; notes: string;
  journalism: { topics: string[]; series: string; plannedPublicationDate: string; publicationStatus: string } | null;
};

const FONT = "Arial";
const BODY_SIZE = 22;
const PAGE_WIDTH = 9360;
const BORDER = { style: "single" as const, size: 4, color: "D9D9D9" };
const run = (value: string, options: { bold?: boolean; size?: number } = {}) => new TextRun({ text: value, font: FONT, size: options.size ?? BODY_SIZE, bold: options.bold, color: "000000" });
const formatDate = (value: string) => {
  if (!value || value === "—") return value || "—";
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00+07:00` : value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
};
const safeTitle = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ").replace(/\s+/g, " ").replace(/[. ]+$/g, "").trim().slice(0, 180).trim() || "Phiếu giao việc";
const textParagraphs = (value: string, size = BODY_SIZE) => String(value || "—").split(/\r?\n/).map((line) => new Paragraph({ spacing: { after: 35, line: 276 }, children: [run(line || " ", { size })] }));
const fieldCell = (label: string, value: string, width: number, compact = false) => new TableCell({ width: { size: width, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, margins: { top: 110, bottom: 110, left: 120, right: 120 }, borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }, children: [new Paragraph({ spacing: { after: 45 }, children: [run(label, { bold: true, size: compact ? 19 : 20 })] }), ...textParagraphs(value, compact ? 20 : BODY_SIZE)] });
const twoColumnTable = (rows: Array<[[string, string], [string, string]]>) => new Table({ width: { size: PAGE_WIDTH, type: WidthType.DXA }, columnWidths: [4680, 4680], rows: rows.map(([left, right]) => new TableRow({ children: [fieldCell(left[0], left[1], 4680), fieldCell(right[0], right[1], 4680)] })) });
const sectionHeading = (number: string, title: string) => new Paragraph({ spacing: { before: 220, after: 100 }, keepNext: true, children: [run(`${number}. ${title}`, { bold: true, size: 25 })] });
const pageHeader = (model: WorkAssignmentPrintModel) => [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [run("TẠP CHÍ THỜI ĐẠI", { bold: true, size: 22 })] }), new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [run("PHIẾU GIAO VIỆC", { bold: true, size: 32 })] }), new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [run(model.department, { bold: true, size: 22 })] })];

function taskChildren(model: WorkAssignmentPrintModel): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [...pageHeader(model), sectionHeading("1", "THÔNG TIN GIAO VIỆC")];
  children.push(twoColumnTable([[["Ngày giao", formatDate(model.assignedDate)], ["Hạn hoàn thành", formatDate(model.deadline)]], [["Người giao việc", model.assigner], ["Người nhận việc", model.primaryAssignee]], [["Người phối hợp", model.collaborators.join(", ") || "—"], ["Hình thức", model.assignmentSourceLabel]]]));
  children.push(sectionHeading("2", "NỘI DUNG CÔNG VIỆC"));
  children.push(twoColumnTable([[ ["Tên công việc", model.title], ["Mô tả", model.description] ], [ ["Yêu cầu", model.requirements.length ? model.requirements.map((item, index) => `${index + 1}. ${item}`).join("\n") : "—"], ["Ghi chú", model.notes] ]]));
  if (model.journalism) { children.push(new Paragraph({ spacing: { before: 180, after: 80 }, keepNext: true, children: [run("THÔNG TIN NGHIỆP VỤ BÁO CHÍ", { bold: true, size: 21 })] })); children.push(twoColumnTable([[ ["Chủ đề", model.journalism.topics.join(", ") || "—"], ["Chuyên mục", model.journalism.series] ], [ ["Ngày dự kiến xuất bản", formatDate(model.journalism.plannedPublicationDate)], ["Trạng thái xuất bản", model.journalism.publicationStatus] ]])); }
  children.push(sectionHeading("3", "XÁC NHẬN"));
  children.push(new Table({ width: { size: PAGE_WIDTH, type: WidthType.DXA }, columnWidths: [3120, 3120, 3120], rows: [new TableRow({ children: [fieldCell(model.assignerLabel.toUpperCase(), `(Ký, ghi rõ họ tên)\n\n${model.assigner}`, 3120, true), fieldCell("NGƯỜI NHẬN VIỆC", `(Ký, ghi rõ họ tên)\n\n${model.primaryAssignee}`, 3120, true), fieldCell("NGƯỜI PHỐI HỢP", `(Ký, ghi rõ họ tên)\n\n${model.collaborators.join(", ") || "—"}`, 3120, true)] })] }));
  return children;
}
const documentFor = (children: (Paragraph | Table)[], title: string) => new Document({ title, subject: "Phiếu giao việc", creator: "Thời Đại Work", styles: { default: { document: { run: { font: FONT, size: BODY_SIZE, color: "000000" } } } }, sections: [{ properties: { page: { margin: { top: 720, right: 900, bottom: 720, left: 900 } } }, children }] });
export function taskPrintDocxFilename(title: string) { return `${safeTitle(title).replace(/\s+/g, "_")}.docx`; }
export async function exportTaskPrintDocx(model: WorkAssignmentPrintModel) { return Packer.toBuffer(documentFor(taskChildren(model), model.title)); }
export async function exportTaskPrintDocxBatch(models: WorkAssignmentPrintModel[]) { const children: (Paragraph | Table)[] = []; models.forEach((model, index) => { if (index) children.push(new Paragraph({ children: [new PageBreak()] })); children.push(...taskChildren(model)); }); return Packer.toBuffer(documentFor(children, "Phiếu giao việc hàng loạt")); }
export async function exportTaskPrintDocxZip(models: WorkAssignmentPrintModel[]) {
  const archive = new JSZip();
  const usedNames = new Set<string>();
  for (const model of models) {
    const baseName = taskPrintDocxFilename(model.title).replace(/\.docx$/i, "");
    let name = `${baseName}.docx`;
    let suffix = 2;
    while (usedNames.has(name.toLowerCase())) name = `${baseName}_${suffix++}.docx`;
    usedNames.add(name.toLowerCase());
    archive.file(name, await exportTaskPrintDocx(model));
  }
  return archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
