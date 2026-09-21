import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("metadata editor is permission-gated and excludes publication controls", () => {
  const page = read("../app/tasks/[id]/page.tsx");
  const shell = read("../components/TaskDetailShell.tsx");
  const editor = read("../components/JournalismMetadataEditor.tsx");
  assert.match(page, /authorizeJournalismPermission\(user, accessResult\.data, "journalism\.metadata\.update"\)/);
  assert.match(shell, /task\.journalism && capabilities\.journalismMetadataUpdate/);
  assert.match(editor, /Chỉnh sửa thông tin/);
  assert.doesNotMatch(editor, /articleUrl|publicationStatus|publishedAt|withdrawalReason|Lên lịch xuất bản|Đánh dấu đã xuất bản|Gỡ bài/);
});

test("metadata editor has dialog accessibility and field error associations", () => {
  const editor = read("../components/JournalismMetadataEditor.tsx");
  assert.match(editor, /role="dialog"/);
  assert.match(editor, /aria-modal="true"/);
  assert.match(editor, /requestAnimationFrame/);
  assert.match(editor, /aria-describedby=\{errors\.location/);
  assert.match(editor, /aria-describedby=\{errors\.editorialNotes/);
  assert.match(editor, /aria-label="Ngày dự kiến xuất bản"/);
  assert.match(editor, /aria-label="Giờ dự kiến xuất bản"/);
});

test("planned publication editing safely supports clearing a date", () => {
  const editor = read("../components/JournalismMetadataEditor.tsx");
  assert.match(editor, /combineVietnamDateTime/);
  assert.match(editor, /return date && time \? .* : ""/);
});

test("normal tasks do not render the journalism metadata editor", () => {
  const shell = read("../components/TaskDetailShell.tsx");
  assert.match(shell, /task\.journalism && capabilities\.journalismMetadataUpdate \? <JournalismMetadataEditor/);
});

test("work-kind loading failure is visible and disables replacement selection", () => {
  const editor = read("../components/JournalismMetadataEditor.tsx");
  const page = read("../app/tasks/[id]/page.tsx");
  assert.match(page, /journalismWorkKindsLoadFailed/);
  assert.match(editor, /disabled=\{workKindsLoadFailed\}/);
  assert.match(editor, /Không thể tải loại nghiệp vụ/);
});
