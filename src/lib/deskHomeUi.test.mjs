import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const source = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
test("desk home puts announcements first in the main column before today and notifications first in the right column", () => {
  const home = source("components/DeskHome.tsx");
  const columns = home.split('<div className="min-w-0 space-y-5">');
  assert.equal(columns.length, 3);
  const mainColumn = columns[1];
  const rightColumn = columns[2].split('<div className="mt-5 grid gap-5')[0];
  assert.match(mainColumn, /^<Card id="desk-announcements" title=\{announcementCopy\.blockAnnouncements\}/);
  assert.ok(mainColumn.indexOf('id="desk-announcements"') < mainColumn.indexOf('id="desk-today"'));
  assert.deepEqual([...rightColumn.matchAll(/<Card id="([^"]+)"/g)].map((match) => match[1]), [
    "desk-notifications", "desk-schedule",
  ]);
});

test("desk home bottom row contains only the full-width library", () => {
  const home = source("components/DeskHome.tsx");
  const bottomRow = home.slice(home.indexOf('<div className="mt-5 grid gap-5'));
  assert.match(bottomRow, /^<div className="mt-5 grid gap-5">/);
  assert.match(bottomRow, /title=\{announcementCopy\.blockLibrary\}/);
  assert.doesNotMatch(bottomRow, /blockAnnouncements/);
  assert.deepEqual([...bottomRow.matchAll(/<Card id="([^"]+)"/g)].map((match) => match[1]), ["desk-library"]);
});
test("desk home source stays ASCII and avoids unicode escapes", () => { for (const path of ["lib/deskHome.mjs", "components/DeskHome.tsx", "lib/deskRepository.ts", "app/page.tsx"]) { const text = source(path); assert.doesNotMatch(text, /[^\x00-\x7F]/); assert.doesNotMatch(text, /\\u[0-9A-Fa-f]{4}/); } });
test("desk home wires required navigation and notification behavior", () => { const home = source("components/DeskHome.tsx"); const nav = source("components/AppNav.tsx"); assert.match(home, /id="desk-today"/); assert.match(home, /id="desk-approvals"/); assert.match(home, /id="desk-notifications"/); assert.match(home, /id="desk-schedule"/); assert.match(home, /POST/); assert.match(home, /\/api\/notifications/); assert.match(nav, /showHome={!isCollaboratorRole/); });
test("repository keeps isolated blocks and no any", () => { const text = source("lib/deskRepository.ts"); for (const name of ["loadTodayBlock", "loadApprovalsBlock", "loadScheduleBlock", "loadShortcutsBlock"]) assert.match(text, new RegExp(name)); assert.doesNotMatch(text, /: any/); });

test("desk home keeps responsive row limits and grouped schedule failures", () => { const home = source("components/DeskHome.tsx"); assert.match(home, /slice\(0, 5\)/); assert.match(home, /hidden lg:flex/); assert.match(home, /deskCopy\.scheduleLeadership/); assert.match(home, /Failure name=\{deskCopy\.blockSchedule\}/); assert.doesNotMatch(home, /float-right/); });
