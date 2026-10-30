import type { AssetQuickFilter } from "./assetListPresentation";

export type AssetListViewState = {
  qName: string;
  qDepartment: string;
  qLocation: string;
  qCondition: string;
  qUsage: string;
  quickFilter: AssetQuickFilter;
  qAssignee: string;
  windowScrollY: number;
  tableScrollTop: number;
  tableScrollLeft: number;
};

export const ASSET_LIST_VIEW_STORAGE_KEY: "thoidai.assets.listView.v1";
export function defaultAssetListViewState(): AssetListViewState;
export function parseAssetListViewState(value: unknown): AssetListViewState;
export function serializeAssetListViewState(state: AssetListViewState): string;
