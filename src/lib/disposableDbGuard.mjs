const DISPOSABLE_PREFIX = "thoidai-disposable-global-mutation-";
export const DISPOSABLE_DB_MARKER = "thoidai-global-mutation-disposable-db-v1";

const PRODUCTION_TOKENS = [
  "supabase_db_thoidai-work",
  "supabase_network_thoidai-work",
  "supabase_.*_thoidai-work",
  "thoidai-work",
  "thoidai_recovery",
  "recovery-smoke",
  "103.216.118.49",
  "vps-aylaspa",
  "/var/run/postgresql",
];
const PRODUCTION_TOKEN_RE = new RegExp(PRODUCTION_TOKENS.join("|"), "i");
const PRODUCTION_DB_PORTS = new Set(["5432", "54332", "55433"]);
const SENSITIVE_ENV_RE = /(?:DATABASE_URL|DB_URL|POSTGRES|PGHOST|PGPORT|PGDATABASE|SUPABASE.*URL|THOIDAI_ENV|APP_ENV|NODE_ENV|PRODUCTION)/i;
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeUrlParts(value) {
  try {
    const parsed = new URL(value);
    return { hostname: parsed.hostname.toLowerCase(), pathname: parsed.pathname, port: parsed.port };
  } catch {
    return null;
  }
}

function hasProductionToken(value) {
  return PRODUCTION_TOKEN_RE.test(text(value));
}

function hasDisposablePrefix(value) {
  return text(value).startsWith(DISPOSABLE_PREFIX);
}

function addReason(reasons, reason) {
  if (!reasons.includes(reason)) reasons.push(reason);
}

export function validateDisposableDbTarget({ env = process.env, dockerEvidence } = {}) {
  const reasons = [];
  const flag = text(env.THOIDAI_DISPOSABLE_DB_TEST);
  const marker = text(env.THOIDAI_DISPOSABLE_DB_MARKER);
  const container = text(env.THOIDAI_DISPOSABLE_DB_CONTAINER);
  const volume = text(env.THOIDAI_DISPOSABLE_DB_VOLUME);
  const network = text(env.THOIDAI_DISPOSABLE_DB_NETWORK);
  const database = text(env.THOIDAI_DISPOSABLE_DB_NAME);
  const url = text(env.THOIDAI_DISPOSABLE_DB_URL);

  if (flag !== "1") addReason(reasons, "THOIDAI_DISPOSABLE_DB_TEST=1 is required");
  if (marker !== DISPOSABLE_DB_MARKER) addReason(reasons, "disposable marker is missing or invalid");
  if (!hasDisposablePrefix(container) || !hasDisposablePrefix(volume) || !hasDisposablePrefix(network)) {
    addReason(reasons, "container, volume, and network must use the disposable prefix");
  }
  if (!database || database === "postgres" || database === "template1" || database === "template0") {
    addReason(reasons, "a dedicated disposable database name is required");
  }
  if (!url) {
    addReason(reasons, "a disposable database URL is required");
  } else {
    const parsed = safeUrlParts(url);
    if (!parsed) {
      addReason(reasons, "database URL is invalid");
    } else {
      if (hasProductionToken(url) || hasProductionToken(parsed.hostname) || hasProductionToken(parsed.pathname)) {
        addReason(reasons, "database URL identifies a protected production or recovery target");
      }
      if (PRODUCTION_DB_PORTS.has(parsed.port)) {
        addReason(reasons, "database URL uses a protected production or recovery port");
      }
      if (!LOCAL_HOSTS.has(parsed.hostname) && parsed.hostname !== container.toLowerCase()) {
        addReason(reasons, "database URL host is not an explicitly disposable local target");
      }
      if (parsed.pathname.replace(/^\//, "") !== database) {
        addReason(reasons, "database URL database does not match the disposable database name");
      }
    }
  }

  for (const [key, value] of Object.entries(env ?? {})) {
    const stringValue = text(value);
    if (!stringValue || !SENSITIVE_ENV_RE.test(key)) continue;
    if (key === "THOIDAI_DISPOSABLE_DB_TEST" || key === "THOIDAI_DISPOSABLE_DB_MARKER" || key.startsWith("THOIDAI_DISPOSABLE_DB_")) continue;
    if (/^(NODE_ENV|THOIDAI_ENV|APP_ENV|PRODUCTION)$/i.test(key) && /^(production|prod|true|1)$/i.test(stringValue)) {
      addReason(reasons, "production environment flag is set");
    }
    if (hasProductionToken(stringValue)) addReason(reasons, "an environment value identifies a protected production or recovery target");
  }

  if (!dockerEvidence || dockerEvidence.exists !== true) {
    addReason(reasons, "Docker evidence for a newly created disposable target is required");
  } else {
    const labels = dockerEvidence.labels ?? {};
    const mounts = Array.isArray(dockerEvidence.mounts) ? dockerEvidence.mounts : [];
    const networks = Array.isArray(dockerEvidence.networks) ? dockerEvidence.networks : [];
    if (labels["com.thoidai.disposable-db-test"] !== DISPOSABLE_DB_MARKER || labels["com.thoidai.disposable"] !== "1") {
      addReason(reasons, "Docker disposable marker does not match");
    }
    if (!mounts.some((item) => text(item?.Name) === volume || text(item?.Destination) === volume)) {
      addReason(reasons, "Docker volume evidence does not match the disposable volume");
    }
    if (!networks.some((item) => text(item) === network || text(item?.Name) === network)) {
      addReason(reasons, "Docker network evidence does not match the disposable network");
    }
  }

  const protectedValues = [container, volume, network, database, url];
  if (protectedValues.some(hasProductionToken)) addReason(reasons, "target names identify a protected production or recovery resource");

  return { ok: reasons.length === 0, reasons };
}

export function assertDisposableDbTarget(input) {
  const result = validateDisposableDbTarget(input);
  if (!result.ok) {
    throw new Error(`Disposable DB target rejected: ${result.reasons.join("; ")}`);
  }
  return result;
}
