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
    new Paragraph({ text: `BÁO CÁO KẾ HOẠCH ${report.period.periodType === "weekly" ? "TUẦN" : "THÁNG"}`, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: `Đơn vị: ${departmentName}` })] }),
    new Paragraph({ children: [new TextRun({ text: `Kỳ: ${report.period.periodStart} - ${report.period.periodEnd}` })] }),
    new Paragraph({ text: "I. Thông tin chung", heading: HeadingLevel.HEADING_1 }),
    new Paragraph(`Tổng số đầu việc: ${report.items.length}`),
    new Paragraph({ text: "II. Kết quả công tác", heading: HeadingLevel.HEADING_1 }),
    new Table({ rows: [new TableRow({ children: ["Nhiệm vụ / tên việc", "Nội dung / yêu cầu", "Thời hạn", "Trạng thái", "Kết quả kỳ"].map((text) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] })) }), ...rows] }),
    new Paragraph({ text: "III. Kế hoạch công tác kỳ tiếp theo", heading: HeadingLevel.HEADING_1 }),
    ...report.items.filter((item) => item.carry_forward).map((item) => new Paragraph(`- ${item.title}`)),
  ] }] });
  return Packer.toBuffer(doc);
}
