import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(new URL("../app/attendance/page.tsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("attendance day table preserves readable columns on mobile", () => {
  assert.match(page, /attendance-day-table/);
  assert.match(page, /cursor-pointer border-t hover:bg-orange-50/);
  assert.match(styles, /\.attendance-day-table\s*\{\s*table-layout:\s*fixed;/);
  assert.match(styles, /\.attendance-day-table th:first-child,[\s\S]*?width:\s*11rem;/);
  assert.match(styles, /\.attendance-day-table th:nth-child\(6\),[\s\S]*?width:\s*10rem;/);
  assert.match(styles, /\.attendance-day-table th:nth-child\(7\),[\s\S]*?width:\s*35%;/);
  assert.match(styles, /\.attendance-day-table\.attendance-organization-table th:nth-child\(7\),[\s\S]*?width:\s*35%;/);
  assert.match(styles, /\.attendance-day-table\.attendance-personal-table th:nth-child\(7\),[\s\S]*?width:\s*35%;/);
  assert.match(styles, /\.attendance-status-cell \.table-status\s*\{[\s\S]*?white-space:\s*normal;/);
  assert.match(styles, /\.attendance-note-cell\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/);
  assert.match(page, /attendance-status-cell/);
  assert.match(page, /attendance-note-cell/);
  assert.match(page, /attendance-organization-table/);
  assert.match(page, /attendance-personal-table/);
  assert.doesNotMatch(page, /attendance-note-action/);
  assert.match(page, /aria-label=\{`Xem chi tiết/);
});
