import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const source = name => readFileSync(new URL(name, import.meta.url), "utf8");

test("task uploader places link control beside attachment and camera controls", () => {
  const uploader = source("./TaskAttachmentUploader.tsx");
  assert.match(uploader, /<CameraCaptureButton[\s\S]*<TaskLinkAttacher/);
  assert.match(uploader, /<TaskLinkAttacher[^>]*disabled=\{disabled \|\| busy\}/);
});
test("link list opens safe external tabs and offers creator/admin deletion", () => {
  const list = source("./TaskLinkList.tsx");
  assert.match(list, /target="_blank" rel="noopener noreferrer"/);
  assert.match(list, /created_by === actorId/);
  assert.match(list, /await requestConfirmation/);
  assert.doesNotMatch(list, /PreviewDialog/);
  for (const name of ["TaskDetailShell", "TaskDetailModal", "AdminTaskAttachments"]) assert.match(source(`./${name}.tsx`), /<TaskLinkList/);
});
test("assignment form offers optional links with the existing attachment field", () => {
  assert.match(source("./CanonicalAssignmentForm.tsx"), /<TaskLinkDraftFields/);
  assert.match(source("./TaskAssignShell.tsx"), /uploadBatchTaskLinks/);
  assert.match(source("./ProjectDetailShell.tsx"), /uploadBatchTaskLinks/);
});
