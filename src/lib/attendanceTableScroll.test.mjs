import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/attendance/page.tsx", import.meta.url), "utf8");

test("organization attendance list uses a bounded vertical scroll area", () => {
  assert.match(page, /isOrganizationView \? "max-h-\[65vh\] overflow-y-auto"/);
  assert.match(page, /Danh sách chấm công toàn cơ quan, cuộn dọc và ngang/);
  assert.match(page, /<thead className="sticky top-0 z-10 bg-slate-50">/);
});
