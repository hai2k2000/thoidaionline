import test from "node:test";
import assert from "node:assert/strict";
import { decideVersionRefresh } from "./versionRefresh.mjs";

const base = { currentBuild: "old", latestBuild: "new", autoReloadStamp: null };
test("reloads hidden or long-resumed clean pages", () => {
  assert.equal(decideVersionRefresh({ ...base, visible: false }), "reload");
  assert.equal(decideVersionRefresh({ ...base, visible: true, resumedFromBackgroundMs: 31_000 }), "reload");
});
test("shows a banner for visible, dirty, or already stamped pages", () => {
  assert.equal(decideVersionRefresh({ ...base, visible: true }), "banner");
  assert.equal(decideVersionRefresh({ ...base, visible: false, dirtyForm: true }), "banner");
  assert.equal(decideVersionRefresh({ ...base, visible: false, autoReloadStamp: "new" }), "banner");
});
test("does nothing when the build matches", () => assert.equal(decideVersionRefresh({ ...base, latestBuild: "old", visible: false }), "none"));
test("30 seconds is not more than 30 seconds; resumed dirty forms stay put", () => {
  assert.equal(decideVersionRefresh({ ...base, visible: true, resumedFromBackgroundMs: 30_000 }), "banner");
  assert.equal(decideVersionRefresh({ ...base, visible: true, resumedFromBackgroundMs: 31_000, dirtyForm: true }), "banner");
  assert.equal(decideVersionRefresh({ ...base, visible: false, latestBuild: "" }), "none");
});
