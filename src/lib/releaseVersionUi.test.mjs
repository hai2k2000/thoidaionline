import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("release version is wired through layout and navigation", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const nav = await readFile(new URL("../components/AppNav.tsx", import.meta.url), "utf8");
  const releaseBuild = await readFile(new URL("./releaseBuild.mjs", import.meta.url), "utf8");
  assert.ok(layout.includes("getReleaseLabel"));
  assert.ok(layout.includes("ReleaseVersionProvider"));
  assert.ok(nav.includes("ReleaseVersionLabel"));
  assert.ok(releaseBuild.includes("releaseLabel"));
  assert.ok(releaseBuild.includes("THOIDAI_APP_VERSION"));
  assert.ok(!releaseBuild.includes("created_at"));
  assert.ok(!releaseBuild.includes("Intl.DateTimeFormat"));
  const nextConfig = await readFile(new URL("../../next.config.ts", import.meta.url), "utf8");
  const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  assert.ok(nextConfig.includes("THOIDAI_APP_VERSION"));
  assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
});

test("my tasks defaults to mine without a task type", async () => {
  const page = await readFile(new URL("../app/my-tasks/page.tsx", import.meta.url), "utf8");
  const repository = await readFile(new URL("./taskRepository.ts", import.meta.url), "utf8");
  const filters = await readFile(new URL("./taskFilters.mjs", import.meta.url), "utf8");
  assert.ok(page.includes('scope: "mine"'));
  assert.ok(!page.includes("type: params.type"));
  assert.ok(repository.includes('query.scope === "mine"'));
  assert.ok(repository.includes("owner_id.eq."));
  assert.ok(repository.includes("assignee_id.eq."));
  assert.ok(filters.includes('"mine"'));
});