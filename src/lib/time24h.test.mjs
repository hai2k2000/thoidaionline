import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  TIME_24H_ERROR_MESSAGE,
  TIME_24H_PATTERN,
  TIME_24H_REGEX,
  formatTime24hInput,
  time24hCaretPosition,
  isValidTime24h,
} from "./time24h.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("accepts strict 24-hour HH:mm values", () => {
  for (const value of ["00:00", "08:00", "12:00", "15:00", "17:30", "23:59"]) {
    assert.equal(isValidTime24h(value), true, value);
    assert.equal(TIME_24H_REGEX.test(value), true, value);
  }
});

test("rejects ambiguous or out-of-range time values", () => {
  for (const value of ["24:00", "23:60", "25:00", "15:99", "3:00", "15:0", "abc", "15-00", "15:00 PM"]) {
    assert.equal(isValidTime24h(value), false, value);
    assert.equal(TIME_24H_REGEX.test(value), false, value);
  }
});

test("publishes a browser-safe pattern and Vietnamese validation message", () => {
  assert.equal(TIME_24H_PATTERN, "(?:[01][0-9]|2[0-3]):[0-5][0-9]");
  assert.equal(TIME_24H_ERROR_MESSAGE, "Vui lòng nhập giờ theo định dạng HH:mm, từ 00:00 đến 23:59.");
});

test("auto-formats digit entry and pasted HH:mm values", () => {
  for (const [input, expected] of [
    ["1", "1"],
    ["15", "15"],
    ["150", "15:0"],
    ["1500", "15:00"],
    ["0800", "08:00"],
    ["1730", "17:30"],
    ["0000", "00:00"],
    ["2359", "23:59"],
    ["1530", "15:30"],
    ["15:30", "15:30"],
    ["15::30", "15:30"],
    ["ab15-30cd", "15:30"],
    ["2460", "24:60"],
  ]) {
    assert.equal(formatTime24hInput(input), expected, input);
  }
});

test("formatter preserves partial backspace edits and a digit-relative caret", () => {
  assert.equal(formatTime24hInput("15:0"), "15:0");
  assert.equal(formatTime24hInput("15:"), "15:");
  assert.equal(time24hCaretPosition("150", 3), 4);
  assert.equal(time24hCaretPosition("15", 2), 2);
});

test("auto-format does not make out-of-range values valid", () => {
  assert.equal(isValidTime24h(formatTime24hInput("2460")), false);
  assert.equal(isValidTime24h(formatTime24hInput("2360")), false);
  assert.equal(isValidTime24h(formatTime24hInput("2900")), false);
});

test("all user-facing time forms use the shared input", () => {
  const components = [
    "../components/AdminTaskEditForm.tsx",
    "../components/CanonicalAssignmentForm.tsx",
    "../components/EventAssignmentPanel.tsx",
    "../components/JournalismManualPublicationReport.tsx",
    "../components/JournalismMetadataEditor.tsx",
    "../components/JournalismPublicationControls.tsx",
    "../components/TaskAssignShell.tsx",
    "../components/WorkScheduleAdminShell.tsx",
    "../components/WorkSchedulePageShell.tsx",
  ];
  for (const path of components) {
    const source = read(path);
    assert.match(source, /Time24hInput/);
    assert.doesNotMatch(source, /type="time"/);
    assert.doesNotMatch(source, /pattern="[^"]*\\\\d/);
  }
});

test("server validators use the shared strict 24-hour regex", () => {
  for (const path of [
    "../app/api/work-schedule/route.ts",
    "../app/api/work-schedule/personal/route.ts",
    "./eventAssignmentValidation.ts",
    "./personalPlanValidation.ts",
    "./taskHandlerFactory.ts",
  ]) {
    assert.match(read(path), /TIME_24H_REGEX/);
  }
});

test("async form submissions capture the form before awaiting reset", () => {
  for (const path of [
    "../components/WorkSchedulePageShell.tsx",
    "../components/WorkScheduleAdminShell.tsx",
    "../components/TaskDetailShell.tsx",
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /event\.currentTarget\.reset\(\)|e\.currentTarget\.reset\(\)/);
  }
});
