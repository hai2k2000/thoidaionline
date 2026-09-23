import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { missingRequiredArtifactRoutes, missingRequiredProductionRoutes } from "./requiredProductionRoutes.mjs";

test("production source contains every required API route", () => {
  assert.deepEqual(missingRequiredProductionRoutes(), []);
});

test("artifact manifest reports a missing route", () => {
  const root = mkdtempSync(join(tmpdir(), "required-routes-"));
  mkdirSync(join(root, ".next", "server"), { recursive: true });
  writeFileSync(join(root, ".next", "server", "app-paths-manifest.json"), JSON.stringify({ "/api/work-schedule/route": "app.js" }));
  assert.deepEqual(missingRequiredArtifactRoutes(root).includes("/api/work-schedule/personal"), true);
});
