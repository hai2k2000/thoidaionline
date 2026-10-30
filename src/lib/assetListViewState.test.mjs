import assert from "node:assert/strict";
import test from "node:test";
import { ASSET_LIST_VIEW_STORAGE_KEY, defaultAssetListViewState, parseAssetListViewState, serializeAssetListViewState } from "./assetListViewState.mjs";

test("asset list view state round-trips filters and scroll positions", () => {
  const state = { qName: "laptop", qDepartment: "dept", qLocation: "loc", qCondition: "broken", qUsage: "unassigned", quickFilter: "lot", qAssignee: "user", windowScrollY: 420, tableScrollTop: 80, tableScrollLeft: 12 };
  assert.equal(ASSET_LIST_VIEW_STORAGE_KEY, "thoidai.assets.listView.v1");
  assert.deepEqual(parseAssetListViewState(serializeAssetListViewState(state)), state);
});

test("garbage view state falls back to defaults and rejects invalid quick filters", () => {
  const defaults = defaultAssetListViewState();
  assert.deepEqual(parseAssetListViewState("not-json"), defaults);
  assert.deepEqual(parseAssetListViewState(JSON.stringify({ qName: 3, quickFilter: "bogus", windowScrollY: -1 })), defaults);
});
