import { deskCopy } from "./deskHomeCopy.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { buildDeskTodayItems, deskDateLabel, deskGreeting, fillCopy, isDeskScheduleVisible, mergeDeskApprovalItems, pickDeskShortcuts, selectDeskNotifications, vietnamToday } from "./deskHome.mjs";
const now = new Date("2026-11-07T05:00:00.000Z");
test("Vietnam date and greeting use timezone", () => { assert.equal(vietnamToday(now), "2026-11-07"); assert.equal(deskDateLabel(now), deskCopy.weekdays[6] + ", 07/11/2026"); assert.equal(deskGreeting("Nguyen Van An", now), deskCopy.greetingNoon + ", An"); });
test("fillCopy replaces named values", () => { assert.equal(fillCopy(deskCopy.dueInDays, { n: 3 }), deskCopy.dueInDays.replace("{n}", "3")); });
test("today items classify overdue, current and soon", () => { const result = buildDeskTodayItems([{ id: "a", title: "Late", due_date: "2026-11-06", due_time: "10:00" }, { id: "b", title: "Today", due_date: "2026-11-07" }, { id: "c", title: "Soon", due_date: "2026-11-09" }, { id: "d", title: "Far", due_date: "2026-11-20" }, { id: "e", title: "No date" }], now); assert.deepEqual(result.items.map((item) => item.id), ["a", "b", "c"]); assert.equal(result.overdueCount, 1); assert.equal(result.todayCount, 1); });
test("same-day elapsed due time is overdue", () => { const result = buildDeskTodayItems([{ id: "a", title: "Past", due_date: "2026-11-07", due_time: "01:00" }], now); assert.equal(result.items[0].label, deskCopy.overdueToday); });
test("approval merge keeps first duplicate", () => { assert.deepEqual(mergeDeskApprovalItems([[{ id: "a" }, { id: "b" }], [{ id: "a" }, { id: "c" }]]).map((item) => item.id), ["a", "b", "c"]); });
test("notifications exclude deadlines and sort newest", () => { const result = selectDeskNotifications([{ kind: "notice", createdAt: "2026-11-01" }, { kind: "deadline", createdAt: "2026-11-03" }, { kind: "notice", createdAt: "2026-11-02" }]); assert.deepEqual(result.map((item) => item.createdAt), ["2026-11-02", "2026-11-01"]); });
test("schedule visibility excludes rejected and cancelled", () => { assert.equal(isDeskScheduleVisible({ approval_status: "REJECTED" }), false); assert.equal(isDeskScheduleVisible({ event_status: "CANCELLED" }), false); assert.equal(isDeskScheduleVisible({}), true); });
test("shortcuts follow navigation order and permissions", () => { const result = pickDeskShortcuts({ primary: [{ id: "database", href: "/database" }, { id: "assign", href: "/tasks/assign" }, { id: "attendance", href: "/attendance" }] }); assert.deepEqual(result.map((item) => item.id), ["assign", "attendance", "database"]); });
test("task list shortcut is first when tasks navigation is visible and omitted otherwise", () => {
  assert.deepEqual(pickDeskShortcuts({ primary: [{ id: "tasks", href: "/tasks" }, { id: "attendance", href: "/attendance" }] }).slice(0, 1), [{ id: "tasks", href: "/tasks", label: deskCopy.shortcutTaskList }]);
  assert.equal(pickDeskShortcuts({ primary: [{ id: "attendance", href: "/attendance" }] }).some((item) => item.id === "tasks"), false);
});
