import assert from "node:assert/strict";
import test from "node:test";

import {
  buildJournalismCreatePayload,
  journalismCreateErrorMessage,
  serializeVietnamPlannedPublication,
  validateJournalismCreateFields,
} from "./journalismCreateUi.mjs";

test("serializes Vietnam local planned publication time without machine timezone dependence", () => {
  assert.equal(
    serializeVietnamPlannedPublication("2026-09-20", "09:30"),
    "2026-09-20T02:30:00.000Z",
  );
  assert.equal(serializeVietnamPlannedPublication("2026-09-20", "01:00"), "2026-09-19T18:00:00.000Z");
  assert.equal(serializeVietnamPlannedPublication("2026-09-20", ""), undefined);
});

test("journalism create validation requires active work kind and enforces text limits", () => {
  assert.deepEqual(validateJournalismCreateFields({ workKindId: "", location: "", editorialNotes: "", plannedPublicationAt: "" }), { workKindId: "required" });
  assert.equal(validateJournalismCreateFields({ workKindId: "kind-1", location: "x".repeat(501), editorialNotes: "", plannedPublicationAt: "" }).location, "max");
  assert.equal(validateJournalismCreateFields({ workKindId: "kind-1", location: "", editorialNotes: "x".repeat(10001), plannedPublicationAt: "" }).editorialNotes, "max");
  assert.equal(validateJournalismCreateFields({ workKindId: "kind-1", location: "", editorialNotes: "", plannedPublicationAt: "not-a-date" }).plannedPublicationAt, "invalid");
});

test("journalism payload is atomic, excludes recurrence and publication mutation fields", () => {
  const payload = buildJournalismCreatePayload({
    title: "Tin mới", description: "- Nội dung", departmentId: "dept-1", assigneeId: "user-1",
    dueDate: "2026-09-21", dueTime: "17:00", collaboratorIds: ["user-2"], watcherIds: ["user-3"],
  }, { workKindId: "kind-1", plannedPublicationAt: "2026-09-20T02:30:00.000Z", location: "Hà Nội", editorialNotes: "Ghi chú" });
  assert.deepEqual(payload.journalism, { workKindId: "kind-1", plannedPublicationAt: "2026-09-20T02:30:00.000Z", location: "Hà Nội", editorialNotes: "Ghi chú" });
  assert.equal(payload.recurrenceFrequency, undefined);
  assert.equal(payload.publicationStatus, undefined);
  assert.equal(payload.publishedAt, undefined);
  assert.equal(payload.articleUrl, undefined);
  assert.equal(payload.actorId, undefined);
  assert.equal(payload.permission, undefined);
});

test("maps Journalism create server errors to safe approved messages", () => {
  assert.equal(journalismCreateErrorMessage("inactive_work_kind"), "Loại nghiệp vụ này đã ngừng sử dụng. Hãy chọn loại khác.");
  assert.equal(journalismCreateErrorMessage("forbidden"), "Bạn không có quyền giao công việc này.");
  assert.equal(journalismCreateErrorMessage("invalid_request"), "Dữ liệu gửi lên chưa hợp lệ. Kiểm tra lại các trường được đánh dấu.");
  assert.equal(journalismCreateErrorMessage("operation_failed"), "Không thể tạo công việc nghiệp vụ báo chí. Vui lòng thử lại.");
});
