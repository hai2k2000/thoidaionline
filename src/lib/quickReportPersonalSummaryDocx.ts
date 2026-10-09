import "server-only";

import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import type { PersonalQuickReportBounds, PersonalQuickReportRow } from "@/lib/quickReportPersonalSummary";
import { personalQuickReportStatusLabel } from "@/lib/quickReportPersonalSummary";
import { formatDateOnlyVN } from "@/lib/businessDate.mjs";

const FONT = "Times New Roman";
const text = (value: string, bold = false) => new TextRun({ text: value, font: FONT, size: 20, bold });
const paragraph = (value: string, bold = false, alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]) => new Paragraph({ alignment, spacing: { after: 90 }, children: [text(value, bold)] });
const cell = (value: string, bold = false) => new TableCell({ width: { size: 2200, type: WidthType.DXA }, children: [new Paragraph({ children: [text(value || "-", bold)] })] });
const date = (value: string | null) => value ? formatDateOnlyVN(value) : "-";
const rowContent = (row: PersonalQuickReportRow, index: number) => new TableRow({ children: [cell(String(index + 1)), cell(date(row.report_work_date)), cell(row.title), cell(row.description ?? ""), cell(date(row.start_date)), cell(date(row.completion_date)), cell(`${row.report_notes ?? ""}${row.report_notes ? " - " : ""}${personalQuickReportStatusLabel(row.status)}`)] });

export async function exportPersonalQuickReportDocx(rows: PersonalQuickReportRow[], employeeName: string, bounds: PersonalQuickReportBounds) {
  const tableRows = [new TableRow({ tableHeader: true, children: ["STT", "Ngày", "Tên công việc", "Nội dung / yêu cầu", "Ngày bắt đầu", "Ngày hoàn thành", "Kết quả / trạng thái"].map((value) => cell(value, true)) }), ...rows.map(rowContent)];
  const document = new Document({ title: "Báo cáo công việc phát sinh", creator: "Thời Đại Work", styles: { default: { document: { run: { font: FONT, size: 20 } } } }, sections: [{ children: [paragraph("TẠP CHÍ THỜI ĐẠI", true, AlignmentType.CENTER), new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [text("BÁO CÁO CÔNG VIỆC PHÁT SINH", true)] }), paragraph(`Nhân viên: ${employeeName}`), paragraph(`Thời gian: ${date(bounds.from)} - ${date(bounds.to)}`), paragraph(`Tổng số công việc phát sinh: ${rows.length}`), new Table({ width: { size: 13200, type: WidthType.DXA }, rows: tableRows }), paragraph(`Người báo cáo: ${employeeName}`)] }] });
  return Packer.toBuffer(document);
}

export const personalQuickReportDocxFilename = (employeeName: string, bounds: PersonalQuickReportBounds) => `Bao_cao_viec_phat_sinh_${employeeName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}_${bounds.from}_${bounds.to}.docx`;