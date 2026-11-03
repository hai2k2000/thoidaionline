import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const page = readFileSync(new URL("../../app/database/records/page.tsx", import.meta.url), "utf8");
test("filters share Tailwind controls across components and use Vietnamese dates", () => {
  assert.ok(!page.includes("<style jsx>"));
  assert.ok(!page.includes('className="control"'));
  assert.ok(page.includes("const controlClass ="));
  assert.ok(page.includes('placeholder="dd/mm/yyyy"'));
  assert.ok(page.includes("grid gap-0 text-sm font-semibold text-slate-700"));
  assert.ok(!page.includes("— $" + "{"));
  assert.ok(page.includes("Nhóm con")); assert.ok(page.includes("Tổ ngôn ngữ"));
  assert.ok(page.includes("Ngày không hợp lệ (dd/mm/yyyy)"));
  assert.ok(page.includes("Ngày bắt đầu sau ngày kết thúc"));
});
