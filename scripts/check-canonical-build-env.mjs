import assert from "node:assert/strict";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
assert.ok(url && !url.startsWith("https://ci.invalid/"), "canonical build requires a valid public Supabase URL");
assert.ok(anon && anon !== "ci-anon-key-placeholder", "canonical build requires a valid public Supabase anon key");
assert.match(service, /^ci-service-role-key-placeholder-[0-9]{20}$/, "canonical CI build must not receive a production service-role key");
console.log("canonical-build-env: PASS (public config only; service-role remains placeholder)");
