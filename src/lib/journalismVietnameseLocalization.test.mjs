import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { journalismLabels, journalismPublicationStatusLabel } from "./journalismUi.mjs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("standard Journalism terms and statuses are Vietnamese", () => {
  assert.equal(journalismLabels.topic, "Chủ đề");
  assert.equal(journalismLabels.series, "Loạt bài");
  assert.equal(journalismLabels.reporter, "Phóng viên");
  assert.equal(journalismLabels.publicationStatus, "Trạng thái xuất bản");
  assert.equal(journalismLabels.plannedPublicationDate, "Ngày dự kiến xuất bản");
  assert.equal(journalismLabels.unplanned, "Chưa lên kế hoạch");
  assert.equal(journalismLabels.overdue, "Quá hạn");
  assert.equal(journalismLabels.editorialNotes, "Ghi chú biên tập");
  assert.equal(journalismLabels.verification, "Xác minh");
  assert.equal(journalismLabels.reconciliation, "Đối soát");
  assert.equal(journalismLabels.manualPublicationReport, "Báo cáo xuất bản thủ công");
  assert.equal(journalismLabels.journalismTask, "Công việc nghiệp vụ báo chí");
  assert.equal(journalismLabels.editorialCalendar, "Lịch nghiệp vụ báo chí");
  assert.equal(journalismLabels.journalismReports, "Báo cáo nghiệp vụ báo chí");
  assert.equal(journalismPublicationStatusLabel("withdrawn"), "Đã rút");
});

test("Journalism UI source does not expose common English labels", () => {
  const files = [
    "../components/JournalismCalendarShell.tsx",
    "../components/JournalismDetailSection.tsx",
    "../components/JournalismManualPublicationReport.tsx",
    "../components/JournalismMetadataEditor.tsx",
    "../components/JournalismPublicationControls.tsx",
    "../components/JournalismReportingDashboard.tsx",
    "../components/JournalismAssociationControls.tsx",
    "../components/JournalismStructuresShell.tsx",
    "../components/JournalismSeriesOrderShell.tsx",
    "../components/JournalismSummary.tsx",
    "../components/TaskAssignShell.tsx",
    "../components/TaskCenterShell.tsx",
    "../components/TaskDetailShell.tsx",
    "../components/WorkAssignmentPrintSheet.tsx",
  ];
  const forbidden = [
    "Journalism · J7 Lite",
    "Journalism Task",
    "Mọi Topic",
    "Mọi Series",
    ">Topic<",
    ">Series<",
    ">Stale<",
    ">Verification<",
    ">Reconciliation<",
  ];
  for (const file of files) {
    const source = read(file);
    for (const label of forbidden) assert.equal(source.includes(label), false, `${file} exposes ${label}`);
  }
});