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

test("asset desktop table keeps six responsive columns without category or tracking metadata", () => {
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
