import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const source = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
test("desk home source stays ASCII and avoids unicode escapes", () => { for (const path of ["lib/deskHome.mjs", "components/DeskHome.tsx", "lib/deskRepository.ts", "app/page.tsx"]) { const text = source(path); assert.doesNotMatch(text, /[^\x00-\x7F]/); assert.doesNotMatch(text, /\\u[0-9A-Fa-f]{4}/); } });
test("desk home wires required navigation and notification behavior", () => { const home = source("components/DeskHome.tsx"); const nav = source("components/AppNav.tsx"); assert.match(home, /id="desk-today"/); assert.match(home, /id="desk-approvals"/); assert.match(home, /id="desk-notifications"/); assert.match(home, /id="desk-schedule"/); assert.match(home, /POST/); assert.match(home, /\/api\/notifications/); assert.match(nav, /showHome={!isCollaboratorRole/); });
test("repository keeps isolated blocks and no any", () => { const text = source("lib/deskRepository.ts"); for (const name of ["loadTodayBlock", "loadApprovalsBlock", "loadScheduleBlock", "loadShortcutsBlock"]) assert.match(text, new RegExp(name)); assert.doesNotMatch(text, /: any/); });

test("desk home keeps responsive row limits and grouped schedule failures", () => { const home = source("components/DeskHome.tsx"); assert.match(home, /slice\(0, 5\)/); assert.match(home, /hidden lg:flex/); assert.match(home, /deskCopy\.scheduleLeadership/); assert.match(home, /Failure name=\{deskCopy\.blockSchedule\}/); assert.doesNotMatch(home, /float-right/); });
