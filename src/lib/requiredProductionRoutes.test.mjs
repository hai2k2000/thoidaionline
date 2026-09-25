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


test("artifact manifest recognizes required page routes", () => {
  const root = mkdtempSync(join(tmpdir(), "required-page-routes-"));
  mkdirSync(join(root, ".next", "server"), { recursive: true });
  const manifest = Object.fromEntries([
    ["/journalism/tasks/page", "app/journalism/tasks/page.js"],
    ...["/api/work-schedule/personal", "/api/work-schedule", "/api/online-work", "/api/online-work-schedule", "/api/auth/session", "/api/work-schedule/events", "/api/tasks/assign", "/api/tasks/journalism/assign", "/api/tasks/[id]/journalism", "/api/tasks/[id]/journalism/publication", "/api/journalism/calendar", "/api/journalism/calendar/[id]"].map((route) => [`${route}/route`, "app.js"]),
  ]);
  writeFileSync(join(root, ".next", "server", "app-paths-manifest.json"), JSON.stringify(manifest));
  assert.equal(missingRequiredArtifactRoutes(root).includes("/journalism/tasks"), false);
});
