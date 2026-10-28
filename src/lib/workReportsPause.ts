// Set false to re-enable both features; no data is deleted while paused.
export const WORK_REPORTS_PAUSED = true;
export const WORK_REPORTS_PAUSED_MESSAGE = "Chức năng báo cáo công việc và báo cáo tuần đang tạm dừng.";
export const PAUSED_WORK_REPORT_NAV_IDS = ["work-report", "weekly-report"] as const;

export function workReportsPausedResponse(): Response {
  return Response.json(
    { error: WORK_REPORTS_PAUSED_MESSAGE, code: "FEATURE_PAUSED" },
    { status: 403, headers: { "Cache-Control": "private, no-store" } },
  );
}
