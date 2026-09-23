import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarRange,
  classifyCalendarTask,
  parseCalendarQuery,
  canViewCalendar,
} from "./journalismCalendar.ts";

test("day, week and month ranges are bounded to the requested anchor", () => {
  assert.deepEqual(calendarRange("day", "2026-09-23"), { from: "2026-09-23", to: "2026-09-23" });
  assert.deepEqual(calendarRange("week", "2026-09-23"), { from: "2026-09-21", to: "2026-09-27" });
  assert.deepEqual(calendarRange("month", "2026-09-23"), { from: "2026-09-01", to: "2026-09-30" });
});

test("calendar status classification distinguishes planned, overdue and publication states", () => {
  assert.equal(classifyCalendarTask({ plannedPublicationAt: null, publicationStatus: "not_published" }, "2026-09-23"), "unplanned");
  assert.equal(classifyCalendarTask({ plannedPublicationAt: "2026-09-22T08:00:00Z", publicationStatus: "not_published" }, "2026-09-23"), "overdue");
  assert.equal(classifyCalendarTask({ plannedPublicationAt: "2026-09-24T08:00:00Z", publicationStatus: "scheduled" }, "2026-09-23"), "scheduled");
  assert.equal(classifyCalendarTask({ plannedPublicationAt: "2026-09-22T08:00:00Z", publicationStatus: "published" }, "2026-09-23"), "published");
  assert.equal(classifyCalendarTask({ plannedPublicationAt: "2026-09-22T08:00:00Z", publicationStatus: "withdrawn" }, "2026-09-23"), "withdrawn");
});

test("query parser accepts only safe J7 filters", () => {
  const reporter = "11111111-1111-4111-8111-111111111111";
  const topic = "22222222-2222-4222-8222-222222222222";
  const series = "33333333-3333-4333-8333-333333333333";
  const query = parseCalendarQuery(new URLSearchParams(`view=week&date=2026-09-23&reporter=${reporter}&status=scheduled&topic=${topic}&series=${series}`));
  assert.deepEqual(query, { view: "week", anchorDate: "2026-09-23", reporterId: reporter, publicationStatus: "scheduled", topicId: topic, seriesId: series });
  const invalid = parseCalendarQuery(new URLSearchParams("view=bad&date=2026-02-30&status=bad&reporter=bad&topic=bad&series=bad"));
  assert.equal(invalid.view, "month");
  assert.equal(invalid.reporterId, null);
  assert.equal(invalid.topicId, null);
  assert.equal(invalid.seriesId, null);
});

test("calendar scope is content department or approved journalism leadership", () => {
  assert.equal(canViewCalendar({ roleCode: "phong_vien", departmentCode: "editorial" }), true);
  assert.equal(canViewCalendar({ roleCode: "tong_bien_tap", departmentCode: "business" }), true);
  assert.equal(canViewCalendar({ roleCode: "pho_tong_bien_tap", departmentCode: "communications" }), true);
  assert.equal(canViewCalendar({ roleCode: "truong_phong", departmentCode: "editorial" }), true);
  assert.equal(canViewCalendar({ roleCode: "admin", departmentCode: "hr" }), true);
  assert.equal(canViewCalendar({ roleCode: "staff", departmentCode: "hr" }), false);
});
