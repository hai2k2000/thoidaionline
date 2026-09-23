import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url).pathname.replace(/%20/g, " ");
const route = (name) => `${root}app/api/journalism/calendar/${name}`;

test("J7 calendar GET route is present and guarded", () => {
  const path = route("route.ts");
  assert.equal(existsSync(path), true);
  const source = readFileSync(path, "utf8");
  assert.match(source, /requireReadActor/);
  assert.match(source, /parseCalendarQuery/);
  assert.match(source, /loadJournalismCalendar/);
});

test("J7 calendar PATCH route only accepts planned publication date", () => {
  const path = route("[id]/route.ts");
  assert.equal(existsSync(path), true);
  const source = readFileSync(path, "utf8");
  assert.match(source, /plannedPublicationAt/);
  assert.match(source, /updatePlannedPublicationDate/);
  assert.doesNotMatch(source, /workKindId|editorialNotes|location/);
});
