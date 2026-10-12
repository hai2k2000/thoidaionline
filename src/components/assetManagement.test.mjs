import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getPhase2Navigation } from "./phase2Navigation.ts";

const employee = { roleCode: "nhan_vien", departmentCode: "general", canAssignTask: false, canEvaluateStep1: false, canEvaluateStep2: false, canManageRubrics: false, canManageUsers: false, canManagePermissions: false };

test("asset navigation is permission-driven for desktop and mobile shared content", () => {
  const navigation = getPhase2Navigation({ ...employee, canViewAssets: true });
  assert.deepEqual(navigation.primary.filter((item) => item.id === "assets"), [{ id: "assets", href: "/assets" }]);
  assert.equal(navigation.primary.find((item) => item.id === "assets")?.href, "/assets");
  assert.equal(getPhase2Navigation(employee).primary.some((item) => item.id === "assets"), false);
});

test("asset screens remain server API clients and expose lifecycle concepts", () => {
  for (const path of ["../app/assets/page.tsx", "../app/assets/new/page.tsx", "../app/assets/[id]/page.tsx"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /@\/lib\/supabase|supabase\.from\(/);
    assert.match(source, /\/api\/assets|listAssets|createAsset|assignAsset/);
  }
  const detail = readFileSync(new URL("../app/assets/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(detail, /action === "transfer"/);
  assert.match(detail, /action === "return"/);
  assert.match(detail, /assignmentHistory|history/i);
  assert.match(detail, /departmentId/);
  assert.match(detail, /assigneeId/);
});

test("asset desktop table keeps the canonical responsive columns without category or tracking metadata", () => {
  const list = readFileSync(new URL("../app/assets/page.tsx", import.meta.url), "utf8");
  const desktopStart = list.indexOf('<div className="hidden md:block">');
  const mobileStart = list.indexOf('<div className="grid gap-3 md:hidden">');
  const desktopTable = list.slice(desktopStart, mobileStart);
  const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.ok(desktopStart >= 0 && mobileStart > desktopStart);
  assert.doesNotMatch(desktopTable, />Nhóm<\/th>/);
  assert.doesNotMatch(desktopTable, />Theo dõi<\/th>/);
  assert.doesNotMatch(desktopTable, /row\.category/);
  assert.doesNotMatch(desktopTable, /row\.tracking_mode/);
  assert.match(desktopTable, /data-table table-fixed min-w-\[900px\]/);
  assert.doesNotMatch(desktopTable, /min-w-\[1220px\]/);
  assert.match(desktopTable, /colSpan=\{6\}/);
  assert.match(desktopTable, /<colgroup>/);
  assert.match(globals, /\.table-scroll\s*\{[^}]*overflow-x:\s*auto;/s);
});

test("asset filters use a balanced responsive grid and separate quick-filter chips", () => {
  const list = readFileSync(new URL("../app/assets/page.tsx", import.meta.url), "utf8");
  const filterStart = list.indexOf('Bộ lọc danh sách');
  const tableStart = list.indexOf('<section className="mt-4 rounded-2xl', filterStart);
  const filters = list.slice(filterStart, tableStart);

  assert.match(filters, /grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 xl:grid-cols-5 items-start/);
  assert.match(filters, /aria-label="Bộ lọc nhanh"/);
  assert.match(filters, /aria-pressed={quickFilter === filter.value}/);
  assert.match(filters, /border-t border-slate-100 pt-3/);
  assert.match(filters, /Tài sản dùng chung của phòng/);
  assert.match(filters, /mt-0.5 leading-4/);
  assert.match(filters, /disabled:cursor-not-allowed disabled:bg-slate-100/);
  assert.doesNotMatch(filters, /<span>Lọc nhanh<\/span><select/);
});

test("asset detail merges custody into the main form and keeps business labels human-readable", () => {
  const detail = readFileSync(new URL("../app/assets/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(detail, /Thông tin tài sản/);
  assert.match(detail, /Phòng đang quản lý/);
  assert.match(detail, /Người đang sử dụng/);
  assert.match(detail, /Ngày cấp phát/);
  assert.match(detail, /Mã tài sản/);
  assert.match(detail, /Kiểu theo dõi/);
  assert.match(detail, /Số lượng/);
  assert.match(detail, /Chuyển giao/);
  assert.match(detail, /Thu hồi/);
  assert.match(detail, /Xác nhận chuyển giao/);
  assert.match(detail, /Xem lịch sử giao nhận/);
  assert.doesNotMatch(detail, />Transfer<|>Return</);
  assert.doesNotMatch(detail, /row\.department_id \?\? "-"/);
  assert.doesNotMatch(detail, /row\.assignee_id \?\? "Phòng ban"/);
  assert.match(detail, /readOnly=\{!canManage\}/);
  assert.match(detail, /disabled=\{!canManage\}/);
});

test("asset detail uses assign for unassigned custody and transfer/return only when assigned", () => {
  const detail = readFileSync(new URL("../app/assets/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(detail, /currentAssignment \?/);
  assert.match(detail, />Chuyển giao<\/button>/);
  assert.match(detail, />Cấp phát<\/button>/);
  assert.match(detail, /runLifecycle\(currentAssignment \? "transfer" : "assign"\)/);
  assert.match(detail, /Xác nhận cấp phát/);
  assert.match(detail, /action: "assign" \| "transfer" \| "return"/);
  assert.match(detail, /currentAssignment && asset\.status === "available"/);
});

test("asset detail renders assignment start and end as separate chronological events", () => {
  const detail = readFileSync(new URL("../app/assets/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(detail, /assigned_at/);
  assert.match(detail, /returned_at/);
  assert.match(detail, /Chuyển giao đến/);
  assert.match(detail, /Chuyển giao đi/);
  assert.match(detail, /events\.sort\(\(a, b\) => new Date\(a\.at\)/);
});

test("asset list rows navigate directly to editable details without a separate action control", () => {
  const list = readFileSync(new URL("../app/assets/page.tsx", import.meta.url), "utf8");
  const desktopStart = list.indexOf('<div className="hidden md:block">');
  const mobileStart = list.indexOf('<div className="grid gap-3 md:hidden">');
  const desktopTable = list.slice(desktopStart, mobileStart);
  const mobileCards = list.slice(mobileStart);

  assert.doesNotMatch(desktopTable, />Hành động<\/th>/);
  assert.doesNotMatch(desktopTable, />Xem <span/);
  assert.match(desktopTable, /<tr key=\{row\.id \?\? row\.asset_code\} className="[^\"]*cursor-pointer/);
  assert.match(desktopTable, /<Link href=\{`\/assets\/\$\{row\.id\}`\}/);
  assert.match(desktopTable, /aria-label=\{`Mở chi tiết tài sản \$\{row\.asset_name\}`\}/);
  assert.match(desktopTable, /colSpan=\{6\}/);
  assert.doesNotMatch(mobileCards, />Xem <span/);
  assert.match(mobileCards, /<Link[^>]*href=\{`\/assets\/\$\{row\.id\}`\}/);
  assert.match(mobileCards, /aria-label=\{`Mở chi tiết tài sản \$\{row\.asset_name\}`\}/);
  assert.match(mobileCards, /cursor-pointer/);
});
