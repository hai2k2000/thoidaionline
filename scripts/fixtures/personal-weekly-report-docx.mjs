import { mkdir, writeFile } from "node:fs/promises";
import { exportPersonalWeeklyReportDocx } from "../../src/lib/personalWeeklyReportDocx.ts";

const base = { period: { current: { start: "2026-10-02", end: "2026-10-09" }, next: { start: "2026-10-09", end: "2026-10-16" } }, employee: { full_name: "Hoàng Quỳnh Trang", department_name: "Phòng Nội dung", job_title_name: "Phóng viên" }, report: { status: "COMPLETED", id: "fixture" }, proposals: [], difficulties: "" };
const row = (index, long = false) => ({ taskId: `fixture-${index}`, title: `${long ? "Công việc nội dung chi tiết " : "Công việc "}${index}`, resultText: long ? "Đã hoàn thành các bước phối hợp, rà soát nội dung, cập nhật tài liệu và bàn giao kết quả theo kế hoạch." : "Đã hoàn thành." });
const fixtures = { short: { ...base, currentRows: [row(1)], nextRows: [row(2)] }, normal: { ...base, currentRows: Array.from({ length: 6 }, (_, i) => row(i + 1)), nextRows: Array.from({ length: 5 }, (_, i) => row(i + 7)) }, long: { ...base, currentRows: Array.from({ length: 28 }, (_, i) => row(i + 1, true)), nextRows: Array.from({ length: 24 }, (_, i) => row(i + 29, true)), difficulties: "Cần phối hợp thêm nguồn lực và thời gian để hoàn thành các nội dung chuyên sâu." } };
const out = new URL("../../artifacts/personal-weekly-report-docx/", import.meta.url);
await mkdir(out, { recursive: true });
for (const [name, viewModel] of Object.entries(fixtures)) await writeFile(new URL(`${name}.docx`, out), await exportPersonalWeeklyReportDocx(viewModel));
