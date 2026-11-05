export const VERSION_CHECK_INTERVAL_MS = 60_000;
export const BACKGROUND_RELOAD_MS = 30_000;

export function decideVersionRefresh({
  currentBuild,
  latestBuild,
  visible,
  resumedFromBackgroundMs = 0,
  dirtyForm = false,
  autoReloadStamp,
}) {
  if (!latestBuild || latestBuild === currentBuild) return "none";
  const autoEligible = !visible || resumedFromBackgroundMs > BACKGROUND_RELOAD_MS;
  if (autoEligible && !dirtyForm && autoReloadStamp !== latestBuild) return "reload";
  return "banner";
}
