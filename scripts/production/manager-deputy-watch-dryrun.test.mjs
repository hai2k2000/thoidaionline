import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("manager deputy watch dry-run is scoped, fail-closed, and behaviour-backed", () => {
  const script = readFileSync("scripts/production/manager-deputy-watch-dryrun.sh", "utf8");
  for (const pattern of [
    /THOIDAI_MANAGER_DEPUTY_WATCH_DRYRUN_APPROVED/, /BUNDLE_DIR/, /MANAGER_DEPUTY_WATCH_DB_URL/, /safe-apply-migration\.sh/,
    /20261106150000_manager_deputy_watch_projects/, /manager_deputy_watch_projects_behaviour/, /trap cleanup EXIT/,
    /MANAGER_DEPUTY_WATCH_DRYRUN_RESULT=PASS/, /leftover dry-run container/,
  ]) assert.match(script, pattern);
  assert.doesNotMatch(script, /systemctl|docker system prune|docker volume prune|set -x/);
});

