import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import JSZip from "jszip";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const period = { start: "2026-10-02", end: "2026-10-09" };
const report = {
  period: { current: period, next: { start: "2026-10-09", end: "2026-10-16" } },
  employee: { full_name: "Nguyễn Văn An", departments: { name: "Phòng Nội dung" } },
  report: { status: "COMPLETED", snapshot_payload: {} },
  currentRows: [
    { taskId: "task-1", title: "Soạn tin tiếng Việt", sourceLabel: "Công việc được giao", status: "done", resultText: "Đã đăng" },
    { taskId: "task-2", title: "Kiểm tra bản thảo", sourceLabel: "Việc phát sinh", status: "in_progress" },
  ],
  nextRows: [{ taskId: "task-3", title: "Lập kế hoạch tháng", sourceLabel: "Kế hoạch phòng ban", status: "assigned" }],
  proposals: [{ id: "proposal-1", title: "Đề xuất chuyên đề" }],
  difficulties: "Cần thêm tài liệu tham khảo",
};

test("weekly routes expose guarded service GET, validated draft POST, and idempotent completion", () => {
  const weekly = source("../app/api/reports/weekly/route.ts");
  const complete = source("../app/api/reports/weekly/complete/route.ts");
  assert.match(weekly, /export async function GET/);
  assert.match(weekly, /loadPersonalWeeklyReport/);
  assert.match(weekly, /export async function POST/);
  assert.match(weekly, /requireMutationActor/);
  assert.match(weekly, /readJsonObject/);
  assert.match(weekly, /validatePersonalWeeklyDraft/);
  assert.match(complete, /export async function POST/);
  assert.match(complete, /completePersonalWeeklyReport/);
  assert.match(complete, /requireMutationActor/);
  assert.doesNotMatch(`${weekly}\n${complete}`, /(?:body|params)\.(?:userId|employeeId|user_id|employee_id)/);
  assert.doesNotMatch(`${weekly}\n${complete}`, /searchParams\.get\(["'](?:userId|employeeId|user_id|employee_id)/);
});

test("reopen route is a guarded POST accepting only reportId and reason", () => {
  const route = source("../app/api/reports/weekly/reopen/route.ts");
  const service = source("./personalWeeklyReportService.ts");
  assert.match(route, /export async function POST/);
  assert.match(route, /reopenPersonalWeeklyReportRequest/);
  assert.doesNotMatch(route, /export async function (GET|PATCH|DELETE)/);
  assert.match(service, /reopenPersonalWeeklyReportRequest/);
  assert.match(service, /requireMutationActor/);
  assert.match(service, /reportId/);
  assert.match(service, /reason/);
  assert.match(service, /Object\.keys/);
  assert.doesNotMatch(`${route}\n${service}`, /(?:body|input)\.(?:userId|employeeId|user_id|employee_id)/);
});

test("weekly page passes version metadata through the authenticated load", () => {
  const page = source("../app/reports/weekly/page.tsx");
  const repository = source("./personalWeeklyReportRepository.ts");
  assert.match(page, /loadPersonalWeeklyReport/);
  assert.match(page, /<PersonalWeeklyReportPage initial=\{result\.data\}/);
  assert.match(repository, /versions: PersonalWeeklyReportVersion\[\]/);
  assert.match(repository, /currentVersionNo: number \| null/);
  assert.match(repository, /reopenEligibility: PersonalWeeklyReopenEligibility/);
});

test("DOCX route exports only the completed shared view model with safe headers", () => {
  const route = source("../app/api/reports/weekly/docx/route.ts");
  assert.match(route, /export async function GET/);
  assert.match(route, /loadPersonalWeeklyReport/);
  assert.match(route, /COMPLETED/);
  assert.match(route, /exportPersonalWeeklyReportDocx/);
  assert.match(route, /personalWeeklyReportDocxFilename/);
  assert.match(route, /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/);
  assert.match(route, /Cache-Control/);
  assert.doesNotMatch(route, /POST|PATCH|DELETE|from\(["']tasks["']\)/);
  assert.match(route, /status !== ["']COMPLETED["']/);
});

test("DOCX route denies reopened DRAFT reports and loads immutable snapshot data", () => {
  const route = source("../app/api/reports/weekly/docx/route.ts");
  const repository = source("./personalWeeklyReportRepository.ts");
  assert.match(route, /result\.data\.report\?\.status !== ["']COMPLETED["']/);
  assert.match(repository, /if \(report\?\.status === ["']COMPLETED["']\)/);
  assert.match(repository, /snapshotRows\(report\)/);
  assert.match(repository, /currentVersionNo/);
  assert.match(repository, /versions/);
});

test("historical page and DOCX requests use a report id without accepting an employee override", () => {
  const service = source("./personalWeeklyReportService.ts");
  const route = source("../app/api/reports/weekly/docx/route.ts");
  assert.match(service, /params\.get\(["']report["']\)/);
  assert.match(route, /loadPersonalWeeklyReport\(request\)/);
  assert.doesNotMatch(`${service}\n${route}`, /searchParams\.get\(["'](?:employeeId|employee_id|userId|user_id)["']\)/);
});

test("DOCX filename cannot inject path or response header characters", async () => {
  const { personalWeeklyReportDocxFilename } = await import("./personalWeeklyReportDocx.ts");
  assert.equal(personalWeeklyReportDocxFilename('Nguyễn / An\r\n"', period), "Ke_hoach_cong_tac_tuan_Nguyen_An_2026-10-02_2026-10-09.docx");
});

test("DOCX has exact Vietnamese sections and the same row counts as the view model", async () => {
  const { exportPersonalWeeklyReportDocx } = await import("./personalWeeklyReportDocx.ts");
  const bytes = await exportPersonalWeeklyReportDocx(report);
  assert.equal(Buffer.from(bytes).subarray(0, 2).toString("ascii"), "PK");
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml").async("string");
  for (const value of ["TẠP CHÍ THỜI ĐẠI", "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", "Độc lập - Tự do - Hạnh phúc", "KẾ HOẠCH CÔNG TÁC TUẦN", "I. Thông tin chung và thời gian làm việc/vắng mặt", "II. Kết quả công tác", "III. Kế hoạch công tác", "IV. Kiến nghị/Đề xuất", "NGƯỜI LẬP", "Nguyễn Văn An", "Phòng Nội dung", "Soạn tin tiếng Việt", "Kiểm tra bản thảo", "Lập kế hoạch tháng", "Đề xuất chuyên đề", "Cần thêm tài liệu tham khảo"]) {
    assert.ok(xml.includes(value), `${value} missing`);
  }
  const footerXml = await zip.file("word/footer1.xml").async("string");
  assert.match(footerXml, /PAGE|fldSimple/);
  for (const mojibake of ["áº", "á»"]) assert.ok(!xml.includes(mojibake));
});

test("completed Word metadata comes from the snapshot view model", async () => {
  const { exportPersonalWeeklyReportDocx } = await import("./personalWeeklyReportDocx.ts");
  const frozen = { ...report, employee: { full_name: "Tên khi hoàn thành", departments: { name: "Phòng ban cũ" } } };
  const bytes = await exportPersonalWeeklyReportDocx(frozen);
  const xml = await (await JSZip.loadAsync(bytes)).file("word/document.xml").async("string");
  assert.match(xml, /Tên khi hoàn thành/);
  assert.match(xml, /Phòng ban cũ/);
});

test("template export omits internal identifiers and workflow enums", async () => {
  const { exportPersonalWeeklyReportDocx } = await import("./personalWeeklyReportDocx.ts");
  const bytes = await exportPersonalWeeklyReportDocx({ ...report, currentRows: [{ taskId: "secret-task", title: "Công việc lịch sử", workflowType: "REPORT_ONLY", status: "in_progress" }] });
  const xml = await (await JSZip.loadAsync(bytes)).file("word/document.xml").async("string");
  assert.doesNotMatch(xml, /secret-task|REPORT_ONLY|task_id|report_id/);
  assert.match(xml, /Công việc lịch sử/);
});
