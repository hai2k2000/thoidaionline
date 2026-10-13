#!/usr/bin/env bash
set -Eeuo pipefail

# Keep the session in this process only; child smoke scripts inherit it.
unset THOIDAI_SMOKE_COOKIE THOIDAI_SMOKE_BEARER

cleanup() {
  unset THOIDAI_SMOKE_COOKIE THOIDAI_SMOKE_BEARER
  printf 'session variables cleared\n' >&2
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

read -r -p 'Credential type [cookie/bearer]: ' credential_type
case "$credential_type" in
  cookie)
    printf 'Complete Cookie header (name=value): ' >&2
    IFS= read -r -s THOIDAI_SMOKE_COOKIE
    printf '\n' >&2
    [[ -n "$THOIDAI_SMOKE_COOKIE" && "$THOIDAI_SMOKE_COOKIE" == *=* ]] || { echo 'invalid cookie header' >&2; exit 2; }
    export THOIDAI_SMOKE_COOKIE
    ;;
  bearer)
    printf 'Bearer token only: ' >&2
    IFS= read -r -s THOIDAI_SMOKE_BEARER
    printf '\n' >&2
    [[ -n "$THOIDAI_SMOKE_BEARER" && "$THOIDAI_SMOKE_BEARER" != *[[:space:]]* ]] || { echo 'invalid bearer token' >&2; exit 2; }
    export THOIDAI_SMOKE_BEARER
    ;;
  *)
    echo 'choose cookie or bearer' >&2
    exit 2
    ;;
esac

node --input-type=module <<'NODE'
const baseUrl = (process.env.THOIDAI_SMOKE_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const cookie = process.env.THOIDAI_SMOKE_COOKIE || "";
const bearer = process.env.THOIDAI_SMOKE_BEARER || "";
const headers = { accept: "application/json", ...(cookie ? { cookie } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) };

async function readJson(path) {
  const response = await fetch(`${baseUrl}${path}`, { headers });
  const body = await response.json().catch(() => null);
  if (response.status !== 200 || !body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error(`${path}: expected authenticated JSON response, got ${response.status}`);
  }
  return body;
}

const session = await readJson("/api/auth/session");
if (!session.user || typeof session.user !== "object") throw new Error("/api/auth/session: user identity missing");
console.log("authenticated identity: PASS");

await readJson("/api/permissions");
console.log("permission catalog: PASS");
NODE

node scripts/contract-smoke.mjs
node scripts/production/browser-path-smoke.mjs
