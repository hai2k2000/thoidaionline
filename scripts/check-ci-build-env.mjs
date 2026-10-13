import assert from "node:assert/strict";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const session = process.env.SESSION_SECRET || "";

assert.equal(new URL(url).hostname, "ci.invalid", "CI build must use the reserved non-production Supabase host");
assert.match(anon, /^ci-anon-key-placeholder$/, "unexpected CI anon key");
assert.match(service, /^ci-service-role-key-placeholder-[0-9]{20}$/, "unexpected CI service-role placeholder");
assert.match(session, /^ci-session-secret-placeholder-[0-9]{20}$/, "unexpected CI session placeholder");
console.log("ci-build-env: PASS (non-production placeholders)");
