import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import test from "node:test";

const pagePath = new URL("../app/permissions/page.tsx", import.meta.url);
const page = readFileSync(pagePath, "utf8");
const permissionDir = new URL("../components/permissions/", import.meta.url);
const sources = readdirSync(permissionDir)
  .filter((name) => /\.(tsx|ts)$/.test(name))
  .map((name) => [name, readFileSync(new URL(name, permissionDir), "utf8")]);
const sourceText = sources.map(([, source]) => source).join("\n");

test("role tab renders every catalog permission, including approval codes", () => {
  assert.doesNotMatch(page, /APPROVAL_PERMISSION_CODES/);
  assert.match(page, /module\.permissions\.map/);
  assert.match(page, /scopeOptions\?\.\[permission\.code\]/);
});

test("other user permissions excludes exactly the approval codes", () => {
  assert.match(sourceText, /APPROVAL_PERMISSION_CODES\.includes/);
  assert.match(sourceText, /OtherPermissionsSection/);
  assert.match(sourceText, /effective/);
  assert.match(sourceText, /overrides/);
});

test("restore-all confirm dialog exists and calls restore_user_inheritance", () => {
  assert.match(sourceText, /Khôi phục tất cả mặc định/);
  assert.match(sourceText, /Xóa toàn bộ/);
  assert.match(sourceText, /restore_user_inheritance/);
});

test("mobile user list and detail are separate screens and history is full-screen", () => {
  assert.match(sourceText, /← Danh sách/);
  assert.match(sourceText, /md:hidden/);
  assert.match(sourceText, /sm:rounded-3xl/);
});

test("approval rows use dialogs and render the complete audit contract", () => {
  assert.match(sourceText, /<GrantDialog/);
  assert.match(sourceText, /<RevokeDialog/);
  assert.doesNotMatch(sourceText, /onGrant=\{\(\) => undefined\}/);
  assert.doesNotMatch(sourceText, /onRevoke=\{\(\) => undefined\}/);
  assert.match(sourceText, /event\.target\.value === "allow" \? onGrant/);
  assert.match(sourceText, /Hiệu lực/);
  assert.match(sourceText, /SOURCE_LABELS/);
  assert.match(sourceText, /Cấp bởi/);
  assert.match(sourceText, /restrictions/);
  assert.match(sourceText, /RESTRICTION_LABELS/);
  assert.match(sourceText, /Người này sẽ duyệt được hồ sơ của MỌI phòng ban/);
  assert.match(sourceText, />Hủy<\/button>/);
  assert.match(sourceText, /Khôi phục/);
  assert.match(sourceText, /aria-label=\{`Thiết lập:/);
  assert.match(sourceText, /selectedUserId \? users\.find/);
  assert.match(sourceText, /aria-label="Phòng ban"/);
  assert.match(sourceText, /aria-label="Vai trò"/);
  assert.match(sourceText, /aria-label="Trạng thái"/);
});

test("all permissions component files exist and stay readable", () => {
  for (const [name] of sources) assert.equal(existsSync(new URL(name, permissionDir)), true, name);
  const paths = [pagePath, ...sources.map(([name]) => new URL(name, permissionDir))];
  for (const path of paths) {
    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      assert.ok(
        line.length <= 200,
        `${path.pathname} line ${index + 1} has ${line.length} characters`,
      );
    });
  }
});
