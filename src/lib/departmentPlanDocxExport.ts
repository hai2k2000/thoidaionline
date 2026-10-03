import "server-only";

import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from "docx";
import type { DepartmentPlanReportResult } from "@/lib/departmentPlanReportRepository";

export async function exportDepartmentPlanDocx(report: DepartmentPlanReportResult, departmentName: string) {
  const rows = report.items.map((item) => new TableRow({ children: [
    new TableCell({ children: [new Paragraph(item.title)] }),
    new TableCell({ children: [new Paragraph(item.description ?? "")] }),
    new TableCell({ children: [new Paragraph(item.due_at ? new Date(item.due_at).toLocaleDateString("vi-VN") : "")] }),
    new TableCell({ children: [new Paragraph(item.work_status)] }),
    new TableCell({ children: [new Paragraph(item.result_this_period ?? "")] }),
  ] }));
  const doc = new Document({ sections: [{ children: [
    new Paragraph({ text: `BÃO CÃO Káº¾ HOáº CH ${report.period.periodType === "weekly" ? "TUáº¦N" : "THÃNG"}`, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: `ÄÆ¡n vá»‹: ${departmentName}` })] }),
    new Paragraph({ children: [new TextRun({ text: `Ká»³: ${report.period.periodStart} - ${report.period.periodEnd}` })] }),
    new Paragraph({ text: "I. ThÃ´ng tin chung", heading: HeadingLevel.HEADING_1 }),
    new Paragraph(`Tá»•ng sá»‘ Ä‘áº§u viá»‡c: ${report.items.length}`),
    new Paragraph({ text: "II. Káº¿t quáº£ cÃ´ng tÃ¡c", heading: HeadingLevel.HEADING_1 }),
    new Table({ rows: [new TableRow({ children: ["Nhiá»‡m vá»¥ / tÃªn viá»‡c", "Ná»™i dung / yÃªu cáº§u", "Thá»i háº¡n", "Tráº¡ng thÃ¡i", "Káº¿t quáº£ ká»³"].map((text) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] })) }), ...rows] }),
    new Paragraph({ text: "III. Káº¿ hoáº¡ch cÃ´ng tÃ¡c ká»³ tiáº¿p theo", heading: HeadingLevel.HEADING_1 }),
    ...report.items.filter((item) => item.carry_forward).map((item) => new Paragraph(`- ${item.title}`)),
  ] }] });
  return Packer.toBuffer(doc);
}
