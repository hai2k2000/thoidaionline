import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./StateViews.tsx", import.meta.url), "utf8");
test("state views expose required roles and labels", () => {
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /role="alert"/);
  assert.match(source, /Thử lại/);
  assert.doesNotMatch(source, /Đang tải\.\.\./);
});

