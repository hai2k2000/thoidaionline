import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const runner = new URL("./run-global-mutation-db-integration.mjs", import.meta.url);
const source = readFileSync(runner, "utf8");

test("DB integration runner verifies the disposable target before psql", () => {
  const guardIndex = source.indexOf("assertDisposableDbTarget");
  const psqlIndex = source.indexOf('spawnSync("psql"');
  assert.ok(guardIndex >= 0);
  assert.ok(psqlIndex > guardIndex);
  assert.match(source, /docker.*inspect|inspectDockerContainer/);
  assert.match(source, /THOIDAI_DISPOSABLE_DB_TEST/);
});

test("DB integration runner fails before any migration when the flag is absent", () => {
  const env = { ...process.env };
  delete env.THOIDAI_DISPOSABLE_DB_TEST;
  const result = spawnSync(process.execPath, [runner.pathname, "--check-only"], {
    env,
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /Disposable DB|THOIDAI_DISPOSABLE_DB_TEST/);
});

test("DB integration runner rejects the live production Supabase target", () => {
  const env = {
    ...process.env,
    THOIDAI_DISPOSABLE_DB_TEST: "1",
    THOIDAI_DISPOSABLE_DB_MARKER: "thoidai-global-mutation-disposable-db-v1",
    THOIDAI_DISPOSABLE_DB_CONTAINER: "supabase_db_thoidai-work",
    THOIDAI_DISPOSABLE_DB_VOLUME: "supabase_db_thoidai-work",
    THOIDAI_DISPOSABLE_DB_NETWORK: "supabase_network_thoidai-work",
    THOIDAI_DISPOSABLE_DB_NAME: "postgres",
    THOIDAI_DISPOSABLE_DB_URL: "postgresql://postgres@supabase_db_thoidai-work:5432/postgres",
  };
  const result = spawnSync(process.execPath, [runner.pathname, "--check-only"], {
    env,
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /production|protected|thoidai-work/i);
});

test("DB integration runner rejects a production target before Docker inspection", () => {
  const env = {
    ...process.env,
    THOIDAI_DISPOSABLE_DB_TEST: "1",
    THOIDAI_DISPOSABLE_DB_MARKER: "thoidai-global-mutation-disposable-db-v1",
    THOIDAI_DISPOSABLE_DB_CONTAINER: "supabase_db_thoidai-work",
    THOIDAI_DISPOSABLE_DB_VOLUME: "supabase_db_thoidai-work",
    THOIDAI_DISPOSABLE_DB_NETWORK: "supabase_network_thoidai-work",
    THOIDAI_DISPOSABLE_DB_NAME: "postgres",
    THOIDAI_DISPOSABLE_DB_URL: "postgresql://postgres@supabase_db_thoidai-work:5432/postgres",
    PATH: "",
  };
  const result = spawnSync(process.execPath, [runner.pathname, "--check-only"], {
    env,
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /production|protected|thoidai-work/i);
  assert.match(`${result.stdout}${result.stderr}`, /before Docker inspection/i);
});
