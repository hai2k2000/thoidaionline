import assert from "node:assert/strict";
import test from "node:test";
import {
  DISPOSABLE_DB_MARKER,
  assertDisposableDbTarget,
  validateDisposableDbTarget,
} from "./disposableDbGuard.mjs";

const baseEnv = {
  THOIDAI_DISPOSABLE_DB_TEST: "1",
  THOIDAI_DISPOSABLE_DB_MARKER: DISPOSABLE_DB_MARKER,
  THOIDAI_DISPOSABLE_DB_CONTAINER: "thoidai-disposable-global-mutation-20260930",
  THOIDAI_DISPOSABLE_DB_VOLUME: "thoidai-disposable-global-mutation-volume-20260930",
  THOIDAI_DISPOSABLE_DB_NETWORK: "thoidai-disposable-global-mutation-network-20260930",
  THOIDAI_DISPOSABLE_DB_NAME: "thoidai_disposable_global_mutation",
  THOIDAI_DISPOSABLE_DB_URL: "postgresql://postgres@127.0.0.1:55439/thoidai_disposable_global_mutation",
};

const dockerEvidence = {
  exists: true,
  labels: {
    "com.thoidai.disposable-db-test": DISPOSABLE_DB_MARKER,
    "com.thoidai.disposable": "1",
  },
  mounts: [{ Name: baseEnv.THOIDAI_DISPOSABLE_DB_VOLUME }],
  networks: [baseEnv.THOIDAI_DISPOSABLE_DB_NETWORK],
};

test("accepts a fully marked disposable target", () => {
  const result = validateDisposableDbTarget({ env: baseEnv, dockerEvidence });
  assert.equal(result.ok, true);
  assert.deepEqual(result.reasons, []);
  assert.doesNotThrow(() => assertDisposableDbTarget({ env: baseEnv, dockerEvidence }));
});

test("fails closed when the explicit disposable flag is absent", () => {
  const result = validateDisposableDbTarget({
    env: { ...baseEnv, THOIDAI_DISPOSABLE_DB_TEST: undefined },
    dockerEvidence,
  });
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(" "), /THOIDAI_DISPOSABLE_DB_TEST/);
});

test("rejects the production Supabase database even with a forged marker", () => {
  const env = {
    ...baseEnv,
    THOIDAI_DISPOSABLE_DB_CONTAINER: "supabase_db_thoidai-work",
    THOIDAI_DISPOSABLE_DB_VOLUME: "supabase_db_thoidai-work",
    THOIDAI_DISPOSABLE_DB_NETWORK: "supabase_network_thoidai-work",
    THOIDAI_DISPOSABLE_DB_NAME: "postgres",
    THOIDAI_DISPOSABLE_DB_URL: "postgresql://postgres@supabase_db_thoidai-work:5432/postgres",
  };
  const result = validateDisposableDbTarget({
    env,
    dockerEvidence: {
      ...dockerEvidence,
      mounts: [{ Name: env.THOIDAI_DISPOSABLE_DB_VOLUME }],
      networks: [env.THOIDAI_DISPOSABLE_DB_NETWORK],
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(" "), /production|thoidai-work/i);
});

test("rejects a production host or connection URL", () => {
  const result = validateDisposableDbTarget({
    env: {
      ...baseEnv,
      THOIDAI_DISPOSABLE_DB_URL: "postgresql://postgres@103.216.118.49:5432/postgres",
    },
    dockerEvidence,
  });
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(" "), /production|host|URL/i);
});

test("rejects protected production and recovery database ports", () => {
  for (const port of ["5432", "54332", "55433"]) {
    const result = validateDisposableDbTarget({
      env: { ...baseEnv, THOIDAI_DISPOSABLE_DB_URL: `postgresql://postgres@127.0.0.1:${port}/${baseEnv.THOIDAI_DISPOSABLE_DB_NAME}` },
      dockerEvidence,
    });
    assert.equal(result.ok, false);
    assert.match(result.reasons.join(" "), /port|production|recovery/i);
  }
});

test("rejects production environment flags and unknown targets", () => {
  const result = validateDisposableDbTarget({
    env: { ...baseEnv, NODE_ENV: "production" },
    dockerEvidence: null,
  });
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(" "), /production|evidence/i);
});

test("requires the Docker marker, matching volume, and matching network", () => {
  const result = validateDisposableDbTarget({
    env: baseEnv,
    dockerEvidence: {
      ...dockerEvidence,
      labels: { "com.thoidai.disposable": "1" },
      mounts: [{ Name: "unknown-volume" }],
      networks: ["unknown-network"],
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(" "), /marker|volume|network/i);
});

test("rejects ambiguous names without the disposable prefix", () => {
  const result = validateDisposableDbTarget({
    env: { ...baseEnv, THOIDAI_DISPOSABLE_DB_CONTAINER: "postgres-test" },
    dockerEvidence,
  });
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(" "), /prefix|ambiguous/i);
});

test("does not print connection material when blocking", () => {
  const secretUrl = "postgresql://user:super-secret@103.216.118.49:5432/postgres";
  assert.throws(
    () => assertDisposableDbTarget({
      env: { ...baseEnv, THOIDAI_DISPOSABLE_DB_URL: secretUrl },
      dockerEvidence,
    }),
    (error) => {
      assert.equal(String(error).includes("super-secret"), false);
      assert.equal(String(error).includes(secretUrl), false);
      return true;
    },
  );
});
