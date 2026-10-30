import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/assets/page.tsx", import.meta.url), "utf8");

test("asset list persists view state safely and restores scroll after loading", () => {
  assert.match(page, /thoidai\.assets\.listView\.v1|ASSET_LIST_VIEW_STORAGE_KEY/);
  assert.match(page, /try\s*\{[\s\S]*sessionStorage\.(?:getItem|setItem)/);
  assert.match(page, /if\s*\(!loaded\s*\|\|\s*scrollRestored\.current\)\s*return/);
  assert.match(page, /requestAnimationFrame[\s\S]*window\.scrollTo[\s\S]*tableScrollRef\.current\.scrollTop/);
});
