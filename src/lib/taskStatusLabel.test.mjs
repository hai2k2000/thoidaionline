import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const source = readFileSync("src/components/TaskCenterShell.tsx", "utf8");
test("task center shows pending review explicitly", () => { assert.match(source, /status === "pending_review" \? "Chờ duyệt"/); });
