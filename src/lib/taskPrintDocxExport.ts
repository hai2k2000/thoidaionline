import {
  AlignmentType,
  Document,
  HeadingLevel,
  PageBreak,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
type WorkAssignmentPrintModel = {
  assignedDate: string; deadline: string; department: string; assignmentSourceLabel: string;
  assignerLabel: string; assigner: string; primaryAssignee: string; collaborators: string[];
  title: string; description: string; requirements: string[]; notes: string;
  journalism: { topics: string[]; series: string; plannedPublicationDate: string; publicationStatus: string } | null;
};

const FONT = "Arial";
const BODY_SIZE = 22;
const BORDER = { style: "single" as const, size: 4, color: "D9D9D9" };
const run = (value: string, options: { bold?: boolean; size?: number } = {}) => new TextRun({ text: value, font: FONT, size: options.size ?? BODY_SIZE, bold: options.bold, color: "000000" });
const paragraph = (value: string, options: { bold?: boolean; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; spacingAfter?: number } = {}) => new Paragraph({ alignment: options.alignment, spacing: { after: options.spacingAfter ?? 120, line: 276 }, children: [run(value, options)] });
const multiline = (value: string) => value.split(/\r?\n/).map((line) => new Paragraph({ spacing: { after: 50, line: 276 }, children: [run(line || " ")] }));
const cell = (label: string, value: string) => new TableCell({ width: { size: 4680, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, margins: { top: 110, bottom: 110, left: 120, right: 120 }, borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }, children: [new Paragraph({ spacing: { after: 50 }, children: [run(label, { bold: true, size: 20 })] }), ...multiline(value || "—")] });
const sectionHeading = (value: string) => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, spacing: { before: 220, after: 100 }, children: [run(value, { bold: true, size: 25 })] });
const safeTitle = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ").replace(/\s+/g, " ").replace(/[. ]+$/g, "").trim().slice(0, 180).trim() || "Phiếu giao việc";
const formatDate = (value: string) => {
  if (!value || value === "—") return value || "—";
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00+07:00` : value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
};

export function taskPrintDocxFilename(title: string) { return `${safeTitle(title).replace(/\s+/g, "_")}.docx`; }

export async function exportTaskPrintDocx(model: WorkAssignmentPrintModel) {
  const assignmentRows = [["Ngày giao", formatDate(model.assignedDate)], ["Hạn hoàn thành", formatDate(model.deadline)], ["Người giao việc", model.assigner], ["Người nhận việc", model.primaryAssignee], ["Người phối hợp", model.collaborators.join(", ") || "—"], ["Hình thức", model.assignmentSourceLabel]];
  const contentRows = [["Tên công việc", model.title], ["Mô tả", model.description], ["Yêu cầu", model.requirements.length ? model.requirements.map((item, index) => `${index + 1}. ${item}`).join("\n") : "—"], ["Ghi chú", model.notes]];
  const children: (Paragraph | Table)[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [run("TẠP CHÍ THỜI ĐẠI", { bold: true, size: 22 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [run("PHIẾU GIAO VIỆC", { bold: true, size: 32 })] }),
    paragraph(model.department, { bold: true, alignment: AlignmentType.CENTER, spacingAfter: 220 }),
    sectionHeading("1. THÔNG TIN GIAO VIỆC"),
    new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [4680, 4680], rows: [new TableRow({ children: assignmentRows.slice(0, 2).map(([label, value]) => cell(label, value)) }), new TableRow({ children: assignmentRows.slice(2, 4).map(([label, value]) => cell(label, value)) }), new TableRow({ children: assignmentRows.slice(4).map(([label, value]) => cell(label, value)) })] }),
    sectionHeading("2. NỘI DUNG CÔNG VIỆC"),
    new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [4680, 4680], rows: [new TableRow({ children: contentRows.slice(0, 2).map(([label, value]) => cell(label, value)) }), new TableRow({ children: contentRows.slice(2).map(([label, value]) => cell(label, value)) })] }),
  ];
  if (model.journalism) {
    children.push(sectionHeading("THÔNG TIN NGHIỆP VỤ BÁO CHÍ"));
    children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [4680, 4680], rows: [new TableRow({ children: [cell("Chủ đề", model.journalism.topics.join(", ") || "—"), cell("Chuyên mục", model.journalism.series)] }), new TableRow({ children: [cell("Ngày dự kiến xuất bản", formatDate(model.journalism.plannedPublicationDate)), cell("Trạng thái xuất bản", model.journalism.publicationStatus)] })] }));
  }
  children.push(sectionHeading("3. XÁC NHẬN"));
  children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [3120, 3120, 3120], rows: [new TableRow({ children: [cell(model.assignerLabel.toUpperCase(), "(Ký, ghi rõ họ tên)\n\n" + model.assigner), cell("NGƯỜI NHẬN VIỆC", "(Ký, ghi rõ họ tên)\n\n" + model.primaryAssignee), cell("NGƯỜI PHỐI HỢP", "(Ký, ghi rõ họ tên)\n\n" + (model.collaborators.join(", ") || "—"))] })] }));
  const doc = new Document({ title: model.title, subject: "Phiếu giao việc", creator: "Thời Đại Work", styles: { default: { document: { run: { font: FONT, size: BODY_SIZE, color: "000000" } }, heading1: { run: { font: FONT, size: 25, bold: true, color: "000000" } } } }, sections: [{ properties: { page: { margin: { top: 720, right: 900, bottom: 720, left: 900 } } }, children }] });
  return Packer.toBuffer(doc);
}

export async function exportTaskPrintDocxBatch(models: WorkAssignmentPrintModel[]) {
  const children: (Paragraph | Table)[] = [];
  for (const [index, model] of models.entries()) {
    if (index > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [run("TẠP CHÍ THỜI ĐẠI", { bold: true, size: 22 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [run("PHIẾU GIAO VIỆC", { bold: true, size: 32 })] }),
      paragraph(model.department, { bold: true, alignment: AlignmentType.CENTER, spacingAfter: 220 }),
      sectionHeading("1. THÔNG TIN GIAO VIỆC"),
      new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [4680, 4680], rows: [
        new TableRow({ children: [["Ngày giao", formatDate(model.assignedDate)], ["Hạn hoàn thành", formatDate(model.deadline)]].map(([label, value]) => cell(label, value)) }),
        new TableRow({ children: [["Người giao việc", model.assigner], ["Người nhận việc", model.primaryAssignee]].map(([label, value]) => cell(label, value)) }),
        new TableRow({ children: [["Người phối hợp", model.collaborators.join(", ") || "—"], ["Hình thức", model.assignmentSourceLabel]].map(([label, value]) => cell(label, value)) }),
      ] }),
      sectionHeading("2. NỘI DUNG CÔNG VIỆC"),
      new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [4680, 4680], rows: [
        new TableRow({ children: [["Tên công việc", model.title], ["Mô tả", model.description]].map(([label, value]) => cell(label, value)) }),
        new TableRow({ children: [["Yêu cầu", model.requirements.length ? model.requirements.map((item, itemIndex) => `${itemIndex + 1}. ${item}`).join("\n") : "—"], ["Ghi chú", model.notes]].map(([label, value]) => cell(label, value)) }),
      ] }),
      sectionHeading("3. XÁC NHẬN"),
      new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [3120, 3120, 3120], rows: [new TableRow({ children: [cell(model.assignerLabel.toUpperCase(), "(Ký, ghi rõ họ tên)\n\n" + model.assigner), cell("NGƯỜI NHẬN VIỆC", "(Ký, ghi rõ họ tên)\n\n" + model.primaryAssignee), cell("NGƯỜI PHỐI HỢP", "(Ký, ghi rõ họ tên)\n\n" + (model.collaborators.join(", ") || "—"))] })] }),
    );
  }
  const doc = new Document({ title: "Phiếu giao việc hàng loạt", subject: "Phiếu giao việc", creator: "Thời Đại Work", styles: { default: { document: { run: { font: FONT, size: BODY_SIZE, color: "000000" } }, heading1: { run: { font: FONT, size: 25, bold: true, color: "000000" } } } }, sections: [{ properties: { page: { margin: { top: 720, right: 900, bottom: 720, left: 900 } } }, children }] });
  return Packer.toBuffer(doc);
}
