import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/attendance/page.tsx", "utf8");
const reviewLeave = page.slice(page.indexOf("const reviewLeave"), page.indexOf("useEffect", page.indexOf("const reviewLeave")));

test("leave approval checks the server response before refreshing", () => {
  assert.match(reviewLeave, /const response = await fetch\("\/api\/leave-requests"/);
  assert.match(reviewLeave, /if \(!response\.ok\) throw new Error/);
});
