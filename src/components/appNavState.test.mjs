import assert from "node:assert/strict";
import test from "node:test";

import * as navState from "./appNavState.ts";

const {
  getInitialOpenGroup,
  groups,
  isActive,
  isSidebarGroupVisible,
  toggleOpenGroup,
} = navState;

test("assignment and planning links live only in their required accordions", () => {
  const work = groups.find((group) => group.key === "work");
  const planning = groups.find((group) => group.key === "planning");

  assert.equal("primaryItems" in navState, false);
  assert.deepEqual(work?.items, [
    { href: "/", label: "Giao việc" },
    { href: "/tasks/active", label: "CV đang triển khai" },
    { href: "/tasks/pending-review", label: "CV chờ duyệt" },
    { href: "/tasks/done", label: "CV hoàn thành" },
    { href: "/performance", label: "Đánh giá" },
  ]);
  assert.deepEqual(planning?.items, [
    { href: "/tasks/personal/new", label: "Tạo nhiệm vụ cá nhân" },
    { href: "/tasks?type=personal", label: "Danh sách nhiệm vụ cá nhân" },
  ]);
});

test("TBT role remains read-only and cannot see planning or admin groups", () => {
  const policy = navState.getRoleAccessPolicy("tbt_read_only");

  assert.deepEqual(policy.modules, ["work", "hr"]);
  assert.equal(policy.readOnly, true);
  assert.equal(policy.viewAllWorkHr, true);
  assert.equal(policy.admin, false);
  assert.equal(navState.isGroupAllowedForRole("tbt_read_only", "work"), true);
  assert.equal(navState.isGroupAllowedForRole("tbt_read_only", "hr"), true);
  assert.equal(navState.isGroupAllowedForRole("tbt_read_only", "planning"), false);
  assert.equal(navState.isGroupAllowedForRole("tbt_read_only", "assets"), false);
  assert.equal(navState.isGroupAllowedForRole("tbt_read_only", "docs"), false);
  assert.equal(navState.isGroupAllowedForRole("tbt_read_only", "admin"), false);
  assert.equal(navState.isGroupAllowedForRole("tong_bien_tap", "planning"), false);
});

test("sidebar keeps work and planning visible and preserves existing hidden modules", () => {
  const visibleGroups = groups.filter((group) => isSidebarGroupVisible(group.key));

  assert.deepEqual(
    visibleGroups.map((group) => group.key),
    ["work", "hr", "admin"],
  );
  assert.equal(groups.find((group) => group.key === "admin")?.label, "Cấu hình");
  assert.equal(
    groups.find((group) => group.key === "admin")?.items.some(
      (item) => item.href === "/job-titles" && item.label === "Quản lý chức vụ",
    ),
    true,
  );
});

test("accordion closes the open group and replaces it with another group", () => {
  assert.equal(toggleOpenGroup(null, "work"), "work");
  assert.equal(toggleOpenGroup("work", "work"), null);
  assert.equal(toggleOpenGroup("work", "planning"), "planning");
  assert.equal(toggleOpenGroup("planning", "hr"), "hr");
});

test("work opens by default while planning routes open the planning accordion", () => {
  const visibleGroups = groups.filter((group) => isSidebarGroupVisible(group.key));

  assert.equal(getInitialOpenGroup(visibleGroups, "/"), "work");
  assert.equal(getInitialOpenGroup(visibleGroups, "/tasks/active"), "work");
  assert.equal(getInitialOpenGroup(visibleGroups, "/performance"), "work");
  assert.equal(getInitialOpenGroup(visibleGroups, "/planning"), "work");
  assert.equal(getInitialOpenGroup(visibleGroups, "/planning/reports"), "work");
  assert.equal(getInitialOpenGroup(visibleGroups, "/my-tasks"), "work");
  assert.equal(getInitialOpenGroup(visibleGroups, "/attendance"), "work");
  assert.equal(getInitialOpenGroup(visibleGroups, "/profile"), "work");
});

test("active routes distinguish planning reports and work status pages", () => {
  assert.equal(isActive("/", "/"), true);
  assert.equal(isActive("/tasks/active", "/"), false);
  assert.equal(isActive("/planning", "/planning"), true);
  assert.equal(isActive("/my-tasks", "/planning"), true);
  assert.equal(isActive("/planning/reports", "/planning"), false);
  assert.equal(isActive("/planning/reports", "/planning/reports"), true);
  assert.equal(isActive("/tasks/active", "/tasks/active"), true);
  assert.equal(isActive("/tasks/active", "/tasks/pending-review"), false);
  assert.equal(isActive("/tasks/pending-review", "/tasks/pending-review"), true);
  assert.equal(isActive("/tasks/done", "/tasks/done"), true);
});

test("active-route fallback is preserved when work is not visible", () => {
  const groupsWithoutWork = groups.filter(
    (group) => group.key !== "work" && isSidebarGroupVisible(group.key),
  );

  assert.equal(getInitialOpenGroup(groupsWithoutWork, "/planning/reports"), null);
  assert.equal(getInitialOpenGroup(groupsWithoutWork, "/attendance"), "hr");
  assert.equal(getInitialOpenGroup(groupsWithoutWork, "/users"), "admin");
  assert.equal(getInitialOpenGroup(groupsWithoutWork, "/profile"), null);
});
