import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("../components/TaskAssignShell.tsx", import.meta.url), "utf8");

test("general assignment renders independent numbered cards with add/remove controls", () => {
  assert.match(shell, /TaskCardFields/);
  assert.match(shell, /VIỆC \{index \+ 1\}/);
  assert.match(shell, /\+ Thêm việc/);
  assert.match(shell, /Xóa việc/);
  assert.match(shell, /MAX_TASK_CARDS/);
});

test("general assignment switches to the explicit batch payload for multiple cards", () => {
  assert.match(shell, /taskCards\.length > 1/);
  assert.match(shell, /buildBatchPayload/);
  assert.match(shell, /crypto\.randomUUID\(\)/);
  assert.match(shell, /currentBatchId/);
  assert.match(shell, /Giao \$\{taskCards\.length\} việc/);
});

test("card UI has no notes field and blocks multi-card attachments until checkpoint 6", () => {
  assert.doesNotMatch(shell, /name=["']notes["']/);
  assert.doesNotMatch(shell, /name=["']ghiChu["']/);
  assert.match(shell, /Tệp đính kèm cho nhiều việc sẽ được hỗ trợ ở bước tiếp theo/);
});
