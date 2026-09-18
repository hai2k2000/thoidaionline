import assert from "node:assert/strict";
import test from "node:test";

import {
  formatJournalismDate,
  journalismPublicationStatusLabel,
  journalismWorkKindLabel,
  safeJournalismArticleUrl,
} from "./journalismUi.mjs";

test("publication statuses use the approved Vietnamese labels", () => {
  assert.equal(journalismPublicationStatusLabel("not_published"), "Chưa xuất bản");
  assert.equal(journalismPublicationStatusLabel("scheduled"), "Đã lên lịch");
  assert.equal(journalismPublicationStatusLabel("published"), "Đã xuất bản");
  assert.equal(journalismPublicationStatusLabel("withdrawn"), "Đã gỡ");
  assert.equal(journalismPublicationStatusLabel("unknown"), "Không rõ trạng thái");
});

test("journalism dates use the product timezone and safe fallback", () => {
  assert.equal(formatJournalismDate(null), "—");
  assert.match(formatJournalismDate("2026-09-20T02:00:00.000Z"), /20 thg 9, 2026/);
});

test("inactive historical work kinds remain readable", () => {
  assert.equal(journalismWorkKindLabel({ name: "Phóng sự", is_active: true }), "Phóng sự");
  assert.equal(journalismWorkKindLabel({ name: "Phóng sự", is_active: false }), "Phóng sự (Ngừng sử dụng)");
});

test("article links accept only absolute http or https URLs", () => {
  assert.equal(safeJournalismArticleUrl("javascript:alert(1)"), null);
  assert.equal(safeJournalismArticleUrl("/relative"), null);
  assert.equal(safeJournalismArticleUrl("https://user:pass@example.com/article"), null);
  assert.equal(safeJournalismArticleUrl("https://example.com/article"), "https://example.com/article");
});
