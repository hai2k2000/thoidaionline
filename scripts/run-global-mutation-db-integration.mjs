#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { assertDisposableDbTarget, DISPOSABLE_DB_MARKER, validateDisposableDbTarget } from "../src/lib/disposableDbGuard.mjs";

function targetFromEnv(env = process.env) {
  return {
    marker: env.THOIDAI_DISPOSABLE_DB_MARKER,
    container: env.THOIDAI_DISPOSABLE_DB_CONTAINER,
    volume: env.THOIDAI_DISPOSABLE_DB_VOLUME,
    network: env.THOIDAI_DISPOSABLE_DB_NETWORK,
    database: env.THOIDAI_DISPOSABLE_DB_NAME,
    url: env.THOIDAI_DISPOSABLE_DB_URL,
  };
}

function inspectDockerContainer(container) {
  const result = spawnSync("docker", ["inspect", "--format", "{{json .}}", container], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error("Disposable DB Docker container could not be verified");
  }
  let inspected;
  try {
    inspected = JSON.parse(result.stdout);
  } catch {
    throw new Error("Disposable DB Docker inspection was ambiguous");
  }
  const networks = Object.keys(inspected?.NetworkSettings?.Networks ?? {});
  return {
    exists: true,
    labels: inspected?.Config?.Labels ?? {},
    mounts: inspected?.Mounts ?? [],
    networks,
  };
}

function psqlEnv(target, env = process.env) {
  const parsed = new URL(target.url);
  const next = { ...env };
  delete next.DATABASE_URL;
  delete next.SUPABASE_DB_URL;
  delete next.PGSERVICE;
  delete next.PGHOSTADDR;
  next.PGHOST = parsed.hostname;
  next.PGPORT = parsed.port || "5432";
  next.PGDATABASE = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  next.PGUSER = decodeURIComponent(parsed.username || "postgres");
  if (parsed.password) next.PGPASSWORD = decodeURIComponent(parsed.password);
  return next;
}

const target = targetFromEnv();
if (process.env.THOIDAI_DISPOSABLE_DB_TEST !== "1") {
  throw new Error("THOIDAI_DISPOSABLE_DB_TEST=1 is required before Docker inspection");
}
const preflight = validateDisposableDbTarget({ env: process.env, dockerEvidence: { exists: true } });
if (preflight.reasons.some((reason) => /protected production|target names identify|database URL identifies|database URL uses a protected|environment value identifies/i.test(reason))) {
  throw new Error("Disposable DB target rejected before Docker inspection: protected target identity");
}
const dockerEvidence = inspectDockerContainer(target.container);
assertDisposableDbTarget({
  env: process.env,
  dockerEvidence,
});

if (process.argv.includes("--check-only")) {
  process.stdout.write(`DISPOSABLE_DB_GUARD_PASS ${DISPOSABLE_DB_MARKER}\n`);
  process.exit(0);
}

const sqlPath = process.argv.find((value) => value.startsWith("--sql="))?.slice("--sql=".length)
  ?? process.argv[process.argv.indexOf("--sql") + 1];
if (!sqlPath) {
  process.stderr.write("Usage: run-global-mutation-db-integration.mjs --sql <file>\n");
  process.exit(2);
}
readFileSync(sqlPath);
const result = spawnSync("psql", ["--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--file", sqlPath], {
  env: psqlEnv(target),
  stdio: "inherit",
});
process.exit(result.status ?? 1);
