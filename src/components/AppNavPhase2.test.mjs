import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const navSource = fs.readFileSync(
  new URL("./AppNav.tsx", import.meta.url),
  "utf8",
);
const authSource = fs.readFileSync(
  new URL("../lib/auth.tsx", import.meta.url),
  "utf8",
);

test("sidebar consumes the canonical Phase-2 navigation policy", () => {
  assert.match(navSource, /getPhase2Navigation/);
  assert.match(navSource, /can_assign_task/);
  assert.match(navSource, /can_evaluate_step1/);
  assert.match(navSource, /can_evaluate_step2/);
  assert.match(navSource, /can_manage_rubrics/);
  assert.match(navSource, /can_manage_users/);
  assert.match(navSource, /can_manage_permissions/);
  assert.doesNotMatch(navSource, /groups\.map|tasks\/active|planning\/reports|href="\/performance"/);
});

test("sidebar renders labels for every restored legacy administration route", () => {
  assert.match(navSource, /users:\s*"Qu\\u1ea3n l\\u00fd nh\\u00e2n vi\\u00ean"/);
  assert.match(navSource, /departments:\s*"Ph\\u00f2ng ban"/);
  assert.match(navSource, /permissions:\s*"Ph\\u00e2n quy\\u1ec1n"/);
});

test("sidebar implements the required off-canvas accessibility contract", () => {
  assert.match(navSource, /role="dialog"/);
  assert.match(navSource, /aria-modal="true"/);
  assert.match(navSource, /Escape/);
  assert.match(navSource, /restoreMenuFocus/);
  assert.match(navSource, /lg:w-\[252px\]/);
});

test("client permission DTO includes every Phase-1 navigation permission", () => {
  assert.match(authSource, /PermissionSet/);
  assert.match(authSource, /can_assign_task/);
  assert.match(authSource, /can_evaluate_step1/);
  assert.match(authSource, /can_evaluate_step2/);
  assert.match(authSource, /can_manage_rubrics/);
});

test("both canonical route shells render the permission-driven sidebar", () => {
  const taskCenter = fs.readFileSync(
    new URL("./TaskCenterShell.tsx", import.meta.url),
    "utf8",
  );
  const taskAssign = fs.readFileSync(
    new URL("./TaskAssignShell.tsx", import.meta.url),
    "utf8",
  );

  assert.match(taskCenter, /<AppNav/);
  assert.match(taskCenter, /query\.journalism === "only" \? "\/tasks\?journalism=only" : basePath/);
  assert.match(taskAssign, /<AppNav/);
  assert.match(taskAssign, /currentPath=\{journalismMode \? "\/tasks\/assign\?kind=journalism"/);
});

test("shared desktop and mobile content renders one scoped Journalism section after work", () => {
  assert.match(navSource, /navigation\.journalism\.length > 0/);
  assert.match(navSource, /open=\{journalismOpen \|\| journalismActive\}/);
  assert.match(navSource, /NGHIỆP VỤ BÁO CHÍ/);
  assert.match(navSource, /"journalism-tasks": "Công việc nghiệp vụ báo chí"/);
  assert.match(navSource, /"journalism-structures": "Chủ đề \/ Loạt bài"/);
  assert.equal((navSource.match(/<NavContent/g) || []).length, 2);
  assert.ok(navSource.indexOf('navigation.primary.filter') < navSource.indexOf('navigation.journalism.length > 0'));
  assert.ok(navSource.indexOf('navigation.journalism.length > 0') < navSource.indexOf('navigation.configuration.length > 0'));
  const detail = fs.readFileSync(new URL('./TaskDetailShell.tsx', import.meta.url), 'utf8');
  assert.match(detail, /currentPath=\{task\.journalism/);
});
