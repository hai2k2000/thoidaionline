import "server-only";

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type { DepartmentPlanPeriod } from "@/lib/departmentPlanPeriod";
import type { DepartmentPlanReportItem } from "@/lib/departmentPlanReport";
import type { DepartmentPlanReportResult } from "@/lib/departmentPlanReportRepository";

const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
const FONT = "Times New Roman";
const BODY_SIZE = 20;
const TABLE_HEADER_FILL = "D9EAF7";
const TABLE_BORDER = { style: "single" as const, size: 4, color: "8FA7BC" };

const workStatusLabels: Record<DepartmentPlanReportItem["work_status"], string> = {
  planned: "Kế hoạch / Chưa bắt đầu",
  in_progress: "Đang thực hiện",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

const assignmentLabels: Record<DepartmentPlanReportItem["assignment_state"], string> = {
  unassigned: "Chưa phân công",
  department_wide: "Cả phòng",
  assigned: "Đã phân công",
};

const text = (value: string, options: { bold?: boolean; color?: string; size?: number } = {}) => new TextRun({ text: value, font: FONT, size: options.size ?? BODY_SIZE, bold: options.bold, color: options.color ?? "000000" });
const paragraph = (value: string, options: { bold?: boolean; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; spacingAfter?: number } = {}) => new Paragraph({ alignment: options.alignment, spacing: { after: options.spacingAfter ?? 80, line: 276 }, children: [text(value, { bold: options.bold })] });
const clean = (value: string | null | undefined) => value?.trim() || "";
const joinLines = (values: Array<string | null | undefined>, fallback = "-") => { const content = values.map(clean).filter(Boolean); return content.length ? content.join("\n") : fallback; };
const formatDate = (value: string | null | undefined) => { if (!value) return "-"; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return new Intl.DateTimeFormat("vi-VN", { timeZone: VIETNAM_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" }).format(date); };
const formatIsoDate = (value: string) => { const [year, month, day] = value.split("-"); return `${day}/${month}/${year}`; };
const progressText = (item: DepartmentPlanReportItem) => joinLines([`Trạng thái: ${workStatusLabels[item.work_status]}`, `Phân công: ${assignmentLabels[item.assignment_state]}`, item.assignee_name ? `Người thực hiện: ${item.assignee_name}` : null, item.progress_start != null || item.progress_end != null ? `Tiến độ: ${item.progress_start ?? 0}% -> ${item.progress_end ?? item.progress_start ?? 0}%` : null, item.period_start_state ? `Đầu kỳ: ${item.period_start_state}` : null, item.period_end_state ? `Cuối kỳ: ${item.period_end_state}` : null]);
const resultText = (item: DepartmentPlanReportItem) => joinLines([item.result_this_period, item.completed_in_period === true ? "Hoàn thành trong kỳ" : null, item.close_classification ? `Phân loại khi chốt: ${item.close_classification}` : null]);
const outstandingText = (item: DepartmentPlanReportItem) => { if (item.work_status === "completed" || item.work_status === "cancelled") return clean(item.carry_over_reason) || "Không có"; return joinLines([item.carry_over_reason, `Tình trạng: ${workStatusLabels[item.work_status]}`, item.carry_forward ? "Hướng xử lý: Chuyển tiếp sang kỳ tiếp theo" : "Hướng xử lý: Tiếp tục theo dõi và cập nhật tiến độ"]); };
const cell = (value: string, options: { header?: boolean; width: number }) => new TableCell({ width: { size: options.width, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, margins: { top: 90, bottom: 90, left: 90, right: 90 }, shading: options.header ? { fill: TABLE_HEADER_FILL } : undefined, borders: { top: TABLE_BORDER, bottom: TABLE_BORDER, left: TABLE_BORDER, right: TABLE_BORDER }, children: value.split("\n").map((line) => new Paragraph({ spacing: { after: 40, line: 240 }, children: [text(line || " ", { bold: options.header, size: options.header ? 19 : 18 })] })) });
const sectionHeading = (value: string) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 220, after: 100 }, keepNext: true, children: [text(value, { bold: true, size: 24 })] });
const safeFilenamePart = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_") || "Phong_ban";
const weeklyFilenamePeriod = (period: DepartmentPlanPeriod) => { const [startYear, startMonth, startDay] = period.periodStart.split("-"); const [endYear, endMonth, endDay] = period.periodEnd.split("-"); if (startYear === endYear && startMonth === endMonth) return `${startDay}-${endDay}_${endMonth}_${endYear}`; if (startYear === endYear) return `${startDay}_${startMonth}-${endDay}_${endMonth}_${endYear}`; return `${startDay}_${startMonth}_${startYear}-${endDay}_${endMonth}_${endYear}`; };
export function departmentPlanDocxFilename(period: DepartmentPlanPeriod, departmentName: string) { const department = safeFilenamePart(departmentName); if (period.periodType === "weekly") return `Bao_cao_cong_tac_tuan_${department}_${weeklyFilenamePeriod(period)}.docx`; const [year, month] = period.periodStart.split("-"); return `Bao_cao_cong_tac_thang_${department}_${month}_${year}.docx`; }
const recommendations = (items: DepartmentPlanReportItem[]) => { const content: string[] = []; const carryForward = items.filter((item) => item.carry_forward); const unassigned = items.filter((item) => item.assignment_state === "unassigned"); const unfinished = items.filter((item) => item.work_status === "planned" || item.work_status === "in_progress"); if (carryForward.length) content.push(`Đề nghị tiếp tục xử lý ${carryForward.length} công việc chuyển tiếp trong kỳ kế tiếp.`); if (unassigned.length) content.push(`Đề nghị phân công người thực hiện cho ${unassigned.length} công việc chưa được phân công.`); if (unfinished.length) content.push(`Đề nghị theo dõi và cập nhật tiến độ ${unfinished.length} công việc chưa hoàn thành.`); return content; };

export async function exportDepartmentPlanDocx(report: DepartmentPlanReportResult, departmentName: string) {
  const plannedItems = report.items.filter((item) => item.period_relation !== "AUTO_ADDED_DURING_PERIOD");
  const spontaneousItems = report.items.filter((item) => item.period_relation === "AUTO_ADDED_DURING_PERIOD");
  const isCompleted = (item: DepartmentPlanReportItem) => item.completed_in_period === true || item.work_status === "completed";
  const completedItems = plannedItems.filter(isCompleted);
  const unfinishedItems = plannedItems.filter((item) => !isCompleted(item) && item.work_status !== "cancelled");
  const nextPeriodItems = report.items.filter((item) => item.carry_forward || item.period_relation === "LONG_RUNNING" || item.period_relation === "RECURRING");
  const completionRate = plannedItems.length ? Math.round((completedItems.length / plannedItems.length) * 100) : 0;
  const widths = [2400, 3000, 1500, 3000, 2400, 3100];
  const headerLabels = ["Nhiệm vụ / tên việc", "Nội dung / yêu cầu", "Thời hạn", "Quá trình triển khai", "Kết quả sản phẩm", "Tồn đọng, nguyên nhân và hướng xử lý"];
  const rows = report.items.map((item) => new TableRow({ cantSplit: true, children: [cell(item.title, { width: widths[0] }), cell(joinLines([item.description, item.requirements]), { width: widths[1] }), cell(formatDate(item.due_at), { width: widths[2] }), cell(progressText(item), { width: widths[3] }), cell(resultText(item), { width: widths[4] }), cell(outstandingText(item), { width: widths[5] })] }));
  const proposalItems = recommendations(report.items); const reportKind = report.period.periodType === "weekly" ? "TUẦN" : "THÁNG"; const planStatus = !report.plan ? "Chưa có kế hoạch" : report.plan.status === "closed" ? "Đã chốt" : "Đang thực hiện";
  const children = [new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [text(`TỔNG KẾT KỲ ${reportKind}`, { bold: true, size: 32 })] }), paragraph(departmentName.toUpperCase(), { bold: true, alignment: AlignmentType.CENTER, spacingAfter: 220 }), sectionHeading("I. Thông tin chung"), paragraph(`Đơn vị: ${departmentName}`), paragraph(`Kỳ báo cáo: ${formatIsoDate(report.period.periodStart)} - ${formatIsoDate(report.period.periodEnd)}`), paragraph(`Trạng thái kỳ: ${planStatus}`), paragraph(`Kế hoạch đầu kỳ: ${plannedItems.length}; hoàn thành: ${completedItems.length}; chưa hoàn thành: ${unfinishedItems.length}; phát sinh ngoài kế hoạch: ${spontaneousItems.length}; tỷ lệ hoàn thành kế hoạch: ${completionRate}%.`), sectionHeading("II. Kết quả công tác"), ...(report.items.length ? [new Table({ width: { size: widths.reduce((sum, width) => sum + width, 0), type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED, rows: [new TableRow({ tableHeader: true, cantSplit: true, children: headerLabels.map((label, index) => cell(label, { header: true, width: widths[index] })) }), ...rows] })] : [paragraph("Không có công việc phù hợp với kỳ và bộ lọc đã chọn.")]), sectionHeading("III. Kế hoạch công tác kỳ tiếp theo"), ...(nextPeriodItems.length ? nextPeriodItems.map((item, index) => paragraph(`${index + 1}. ${item.title}${item.carry_over_reason ? ` - ${item.carry_over_reason}` : ""}`)) : [paragraph("Không có công việc dài hạn, chuyển tiếp hoặc định kỳ cho kỳ tiếp theo.")]), ...(proposalItems.length ? [sectionHeading("IV. Kiến nghị/Đề xuất"), ...proposalItems.map((item, index) => paragraph(`${index + 1}. ${item}`))] : [])];
  const doc = new Document({ title: `Báo cáo công tác ${report.period.periodType === "weekly" ? "tuần" : "tháng"} ${departmentName}`, subject: "Báo cáo công tác phòng ban", creator: "Thời Đại Work", styles: { default: { document: { run: { font: FONT, size: BODY_SIZE, color: "000000" } }, heading1: { run: { font: FONT, size: 24, bold: true, color: "000000" } }, title: { run: { font: FONT, size: 32, bold: true, color: "000000" } } } }, sections: [{ properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children }] });
  return Packer.toBuffer(doc);
}
