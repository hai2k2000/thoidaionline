import assert from "node:assert/strict";
import test from "node:test";

import { parseTaskListSearchParams, taskListHref } from "./taskFilters.mjs";

test("Journalism filters accept bounded valid values", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const query = parseTaskListSearchParams(new URLSearchParams({
    journalism: "only",
    workKind: id,
    publicationStatus: "scheduled",
    plannedFrom: "2026-10-01",
    plannedTo: "2026-10-31",
  }));
  assert.equal(query.journalism, "only");
  assert.equal(query.journalismWorkKindId, id);
  assert.equal(query.publicationStatus, "scheduled");
  assert.equal(query.plannedPublicationFrom, "2026-10-01");
  assert.equal(query.plannedPublicationTo, "2026-10-31");
});
test("Journalism filters reject invalid values without widening the query", () => {
  const query = parseTaskListSearchParams(new URLSearchParams({
    journalism: "maybe",
    workKind: "not-a-uuid",
    publicationStatus: "drafting",
    plannedFrom: "2026-02-30",
  }));
  assert.equal(query.journalism, null);
  assert.equal(query.journalismWorkKindId, null);
  assert.equal(query.publicationStatus, null);
  assert.equal(query.plannedPublicationFrom, null);
});

test("Journalism filters round-trip through the task URL", () => {
  const href = taskListHref({
    search: null, scope: "all", taskType: null, category: null, status: null,
    statusGroup: null, fromDate: null, toDate: null, deadlineState: null,
    departmentId: null, journalism: "exclude",
    journalismWorkKindId: "11111111-1111-4111-8111-111111111111",
    publicationStatus: "published", plannedPublicationFrom: "2026-10-01",
    plannedPublicationTo: "2026-10-31", page: 1, pageSize: 25,
  }, {});
  assert.match(href, /journalism=exclude/);
  assert.match(href, /workKind=11111111-1111-4111-8111-111111111111/);
  assert.match(href, /publicationStatus=published/);
});

test("Journalism subfilters imply only and switching to normal clears them", () => {
  const base = {
    search: null, scope: "all", taskType: null, category: null, status: null,
    statusGroup: null, fromDate: null, toDate: null, deadlineState: null,
    departmentId: null, journalism: null,
    journalismWorkKindId: "11111111-1111-4111-8111-111111111111",
    publicationStatus: "published", plannedPublicationFrom: "2026-10-01",
    plannedPublicationTo: "2026-10-31", page: 1, pageSize: 25,
  };
  const only = taskListHref(base, {});
  assert.match(only, /journalism=only/);
  const normal = taskListHref({ ...base, journalism: "only" }, { journalism: "exclude" });
  assert.match(normal, /journalism=exclude/);
  assert.doesNotMatch(normal, /workKind=|publicationStatus=|plannedFrom=|plannedTo=/);
});

test("parsing a Journalism subfilter implies Journalism-only results", () => {
  const query = parseTaskListSearchParams(new URLSearchParams({ publicationStatus: "scheduled" }));
  assert.equal(query.journalism, "only");
  assert.equal(query.publicationStatus, "scheduled");
});

test("normal-task mode clears Journalism-only subfilters from direct URLs", () => {
  const query = parseTaskListSearchParams(new URLSearchParams({
    journalism: "exclude", publicationStatus: "published", plannedFrom: "2026-10-01",
  }));
  assert.equal(query.journalism, "exclude");
  assert.equal(query.publicationStatus, null);
  assert.equal(query.plannedPublicationFrom, null);
});
