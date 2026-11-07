import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
test("avatar route serves protected image bytes without signed URLs", () => {
  const route = read("../app/api/account/avatar/route.ts");
  assert.match(route, /export async function GET/);
  assert.doesNotMatch(route, /createSignedUrl|signedUrl/);
});
test("server session uses relative avatar proxy URL", () => {
  const session = read("serverSession.ts");
  assert.doesNotMatch(session, /createSignedUrl/);
  assert.match(session, /\/api\/account\/avatar/);
});
test("collaborators can read their avatar", () => {
  assert.match(read("collaboratorRole.mjs"), /\/api\/account\/avatar.*GET/);
});
