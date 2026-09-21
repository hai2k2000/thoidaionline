import assert from "node:assert/strict";
import test from "node:test";

import { buildJournalismMetadataPatch, journalismLocalDateTime, validateJournalismMetadataEdit } from "./journalismMetadataEdit.mjs";

const base = { workKindId: "active-1", plannedPublicationAt: "2026-09-20T02:30:00.000Z", location: "Hà Nội", editorialNotes: "Ghi chú" };

test("metadata patch sends only changed location", () => {
  assert.deepEqual(buildJournalismMetadataPatch(base, { ...base, location: "Đà Nẵng" }, "not_published"), { location: "Đà Nẵng" });
});

test("metadata patch omits unchanged inactive work kind", () => {
  const inactive = { ...base, workKindId: "inactive-1" };
  assert.deepEqual(buildJournalismMetadataPatch(inactive, { ...inactive, location: "Huế" }, "not_published"), { location: "Huế" });
});

test("metadata patch handles planned time and locked published states", () => {
  assert.deepEqual(buildJournalismMetadataPatch(base, { ...base, plannedPublicationAt: "2026-09-21T02:30:00.000Z" }, "scheduled"), { plannedPublicationAt: "2026-09-21T02:30:00.000Z" });
  assert.equal(buildJournalismMetadataPatch(base, { ...base, plannedPublicationAt: "2026-09-21T02:30:00.000Z" }, "published"), null);
});

test("metadata edit has a true no-op and validates scheduled planned time", () => {
  assert.equal(buildJournalismMetadataPatch(base, { ...base }, "not_published"), null);
  assert.deepEqual(validateJournalismMetadataEdit({ ...base, plannedPublicationAt: "" }, "scheduled"), { plannedPublicationAt: "required" });
  assert.equal(validateJournalismMetadataEdit({ ...base }, "published").plannedPublicationAt, undefined);
});

test("metadata edit displays planned time in Vietnam timezone", () => {
  assert.deepEqual(journalismLocalDateTime("2026-09-20T02:30:00.000Z"), { date: "2026-09-20", time: "09:30" });
});
