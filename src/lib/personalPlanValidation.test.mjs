import assert from "node:assert/strict";
import test from "node:test";
import { validateLocalPlanInterval, isMaterialPersonalPlanChange } from "./personalPlanValidation.ts";

test("accepts a valid same-day Vietnam-local interval", () => {
  assert.deepEqual(validateLocalPlanInterval({
    workDate: "2026-09-21",
    endDate: "2026-09-21",
    startTime: "08:30",
    endTime: "17:00",
  }), { ok: true });
});

test("rejects invalid dates and invalid HH:mm values", () => {
  assert.equal(validateLocalPlanInterval({
    workDate: "2026-02-29",
    endDate: "2026-02-29",
    startTime: "08:00",
    endTime: "09:00",
  }).ok, false);
  assert.equal(validateLocalPlanInterval({
    workDate: "2028-02-29",
    endDate: "2028-03-01",
    startTime: "08:60",
    endTime: "09:00",
  }).ok, false);
});

test("requires a strictly later combined end for same-day and multi-day plans", () => {
  assert.equal(validateLocalPlanInterval({
    workDate: "2026-09-21",
    endDate: "2026-09-21",
    startTime: "17:00",
    endTime: "17:00",
  }).ok, false);
  assert.deepEqual(validateLocalPlanInterval({
    workDate: "2028-02-29",
    endDate: "2028-03-01",
    startTime: "23:30",
    endTime: "00:15",
  }), { ok: true });
});

test("material edits include plan content, dates, times, and location", () => {
  const before = { planType: "business", workDate: "2026-09-21", endDate: "2026-09-21", startTime: "08:00", endTime: "09:00", title: "A", location: "B", notes: "C" };
  assert.equal(isMaterialPersonalPlanChange(before, { ...before }), false);
  assert.equal(isMaterialPersonalPlanChange(before, { ...before, endTime: "10:00" }), true);
  assert.equal(isMaterialPersonalPlanChange(before, { ...before, notes: "C updated" }), true);
});
