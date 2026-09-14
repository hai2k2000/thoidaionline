import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const unit = readFileSync(new URL("../../deploy/systemd/thoidai-work.service", import.meta.url), "utf8");

test("production Next.js service binds only to localhost behind nginx", () => {
  assert.match(unit, /ExecStart=.*--hostname 127\.0\.0\.1 --port 3001/);
  assert.doesNotMatch(unit, /--hostname 0\.0\.0\.0/);
});

