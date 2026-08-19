import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/tasks/[id]/page.tsx", import.meta.url), "utf8");

test("task detail wrapper passes all TaskDetailShell capabilities", () => {
  assert.match(page, /evaluate:\s*action\("evaluate"\)/);
  assert.match(page, /personalDeadline:\s*action\("personal_deadline"\)/);
});
