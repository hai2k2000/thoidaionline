import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const page = readFileSync(new URL("../../app/database/records/page.tsx", import.meta.url), "utf8");
test("filters share Tailwind controls across components and use Vietnamese dates", () => {
  assert.ok(!page.includes("<style jsx>"));
  assert.ok(!page.includes('className="control"'));
  assert.ok(page.includes("const controlClass ="));
  assert.ok(page.includes('placeholder="dd/mm/yyyy"'));
  assert.ok(page.includes("grid min-w-0 gap-0 text-xs font-medium text-slate-500"));
  assert.ok(!page.includes("— $" + "{"));
  assert.ok(page.includes("Nhóm con")); assert.ok(page.includes("Tổ ngôn ngữ"));
  assert.ok(page.includes("Ngày không hợp lệ (dd/mm/yyyy)"));
  assert.ok(page.includes("Ngày bắt đầu sau ngày kết thúc"));
});

test("record type filter disables until a group and any required child are selected", () => {
  assert.ok(page.includes('const recordTypeDisabled = !resolved.rootId ||'));
  assert.ok(page.includes('Chọn nhóm hồ sơ trước'));
  assert.ok(page.includes('(resolved.mode === "language" || resolved.mode === "children") && !resolved.subId'));
  assert.ok(page.includes('disabled={recordTypeDisabled}'));
  assert.ok(page.includes('Chọn tổ ngôn ngữ trước'));
  assert.ok(page.includes('Chọn nhóm con trước'));
  assert.ok(page.includes('recordTypes.find((item) => item.id === value)?.name'));
});


test("compact filters keep responsive rows, collapsed advanced controls and clear-all chips", () => {
  const panel = page.slice(page.indexOf("function Advanced("), page.indexOf("function OptionField("));
  for (const heading of ["Thời gian", "Người và đơn vị", "Thuộc tính"]) assert.ok(!panel.includes(heading));
  assert.ok(panel.includes("sm:grid-cols-2 lg:grid-cols-4"));
  assert.ok(page.includes("lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]"));
  assert.ok(page.includes("2xl:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(11rem,1fr))_auto]"));
  assert.ok(page.includes("lg:grid-cols-[repeat(2,minmax(0,1fr))_auto]"));
  assert.ok(page.includes("2xl:grid-cols-[minmax(0,1.3fr)_repeat(2,minmax(11rem,1fr))_auto]"));
  assert.ok(page.includes("Lọc nâng cao"));
  assert.ok(page.includes("Xóa tất cả"));
  assert.ok(page.includes("[advanced, setAdvanced] = useState(false)"));
  assert.ok(page.includes("lg:col-span-full 2xl:col-span-1"));
  const mainFilters = page.slice(page.indexOf("<form "), page.indexOf("</form>"));
  const selects = mainFilters.match(/<select\b/g) ?? [];
  assert.equal(selects.length, 4);
  assert.equal((mainFilters.match(/<select title=/g) ?? []).length, 4);
  assert.ok(page.includes("advancedCount > 0"));
  assert.ok(page.includes("aria-expanded={advanced}"));
  assert.ok(page.includes('const controlClass = "mt-1 h-10'));
  assert.ok(page.indexOf("Xóa tất cả") < page.indexOf("{advanced && <Advanced"));
  assert.ok(page.includes('grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'));
});
