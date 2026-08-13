import assert from "node:assert/strict";
import test from "node:test";

import * as navState from "./appNavState.ts";

const {
  getInitialOpenGroup,
  groups,
  isSidebarGroupVisible,
  toggleOpenGroup,
} = navState;

test("TBT role is read-only and limited to work and HR", () => {
  assert.equal(typeof navState.getRoleAccessPolicy, "function");
  const policy = navState.getRoleAccessPolicy("tbt_read_only");
  assert.deepEqual(policy.modules, ["work", "hr"]);
  assert.equal(policy.readOnly, true);
  assert.equal(policy.viewAllWorkHr, true);
  assert.equal(policy.admin, false);
  assert.equal(typeof navState.isGroupAllowedForRole, "function");
  assert.equal(navState.isGroupAllowedForRole("tbt_read_only", "work"), true);
  assert.equal(navState.isGroupAllowedForRole("tbt_read_only", "hr"), true);
  assert.equal(navState.isGroupAllowedForRole("tbt_read_only", "assets"), false);
  assert.equal(navState.isGroupAllowedForRole("tbt_read_only", "docs"), false);
  assert.equal(navState.isGroupAllowedForRole("tbt_read_only", "admin"), false);
});

test("TBT evaluation access does not expose restricted navigation", () => {
  const policy = navState.getRoleAccessPolicy("tbt_read_only");
  const workGroup = navState.groups.find((group) => group.key === "work");

  assert.equal(workGroup?.items.some((item) => item.href === "/performance"), true);
  assert.deepEqual(policy.modules, ["work", "hr"]);
  assert.equal(policy.admin, false);
  assert.equal(navState.isGroupAllowedForRole("tbt_read_only", "assets"), false);
  assert.equal(navState.isGroupAllowedForRole("tbt_read_only", "docs"), false);
  assert.equal(navState.isGroupAllowedForRole("tbt_read_only", "admin"), false);
});


test("sidebar configuration hides assets and documents and renames admin", () => {
  const visibleGroups = groups.filter((group) => isSidebarGroupVisible(group.key));

  assert.deepEqual(
    visibleGroups.map((group) => group.key),
    ["work", "hr", "admin"],
  );
  assert.equal(
    groups.find((group) => group.key === "admin")?.label,
    "Cấu hình",
  );
  assert.equal(groups.find((group) => group.key === "work")?.items.some((item) => item.href === "/performance"), true);
  assert.equal(groups.find((group) => group.key === "hr")?.items.some((item) => item.href === "/performance"), false);
});

test("accordion closes the open group and replaces it with another group", () => {
  assert.equal(toggleOpenGroup(null, "work"), "work");
  assert.equal(toggleOpenGroup("work", "work"), null);
  assert.equal(toggleOpenGroup("work", "hr"), "hr");
  assert.equal(toggleOpenGroup("hr", "admin"), "admin");
});

test("current routes initialize only their visible parent group", () => {
  const visibleGroups = groups.filter((group) => isSidebarGroupVisible(group.key));

  assert.equal(getInitialOpenGroup(visibleGroups, "/"), "work");
  assert.equal(getInitialOpenGroup(visibleGroups, "/tasks/[id]"), "work");
  assert.equal(getInitialOpenGroup(visibleGroups, "/performance"), "work");
  assert.equal(getInitialOpenGroup(visibleGroups, "/attendance"), "hr");
  assert.equal(getInitialOpenGroup(visibleGroups, "/users"), "admin");
  assert.equal(getInitialOpenGroup(visibleGroups, "/assets"), null);
  assert.equal(getInitialOpenGroup(visibleGroups, "/documents"), null);
  assert.equal(getInitialOpenGroup(visibleGroups, "/profile"), null);
});