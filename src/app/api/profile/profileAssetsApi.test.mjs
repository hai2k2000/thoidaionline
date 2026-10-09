import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("./assets/route.ts", import.meta.url), "utf8");
const profile = readFileSync(new URL("../../profile/page.tsx", import.meta.url), "utf8");

test("profile asset endpoint derives actor from server session", () => {
  assert.match(route, /getSessionUser/);
  assert.match(route, /listAssetsForActor/);
  assert.doesNotMatch(route, /searchParams.*user|user_id|actorId/);
});

test("profile browser fetches scoped endpoint instead of asset tables", () => {
  assert.match(profile, /fetch\("\/api\/profile\/assets"/);
  assert.doesNotMatch(profile, /\.from\("asset_assignments"\)/);
});
