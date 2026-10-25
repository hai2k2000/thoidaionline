import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/attendance/page.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("attendance page lets the content track shrink around the scrollable table", () => {
  assert.match(page, /attendance-page-main mobile-page-shell/);
  assert.match(page, /w-full min-w-0 max-w-7xl lg:grid lg:grid-cols-\[260px_minmax\(0,1fr\)\]/);
  assert.match(page, /<div className="min-w-0">/);
  assert.match(page, /table-scroll min-w-0 max-w-full/);
  assert.doesNotMatch(page, /<th scope="col"[^>]*>Thao tác<\/th>/);
  assert.match(page, /<th scope="col" className="min-w-64 px-3 py-2">Ghi chú<\/th>/);
});

test("attendance page does not clip intentional horizontal table scrolling on mobile", () => {
  assert.match(styles, /\.attendance-page-main\s*\{\s*overflow-x:\s*visible;\s*\}/);
  assert.match(styles, /\.table-scroll\s*\{[\s\S]*?max-width:\s*100%;[\s\S]*?overflow-x:\s*auto;/);
});
