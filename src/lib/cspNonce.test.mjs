import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("static Next config no longer defines a script CSP", () => {
  const nextConfig = read("../../next.config.ts");
  assert.doesNotMatch(nextConfig, /unsafe-eval/);
  assert.doesNotMatch(nextConfig, /Content-Security-Policy/);
});

test("proxy creates a per-request nonce CSP for forwarded requests and responses", () => {
  const proxy = read("../proxy.ts");
  assert.match(proxy, /'nonce-\$\{nonce\}'/);
  assert.match(proxy, /'strict-dynamic'/);
  assert.match(proxy, /requestHeaders\.set\("x-nonce", nonce\)/);
  assert.match(proxy, /requestHeaders\.set\(\s*"Content-Security-Policy"/);
  assert.match(proxy, /response\.headers\.set\(\s*"Content-Security-Policy"/);
  assert.match(proxy, /process\.env\.NODE_ENV === "development"/);

  const unsafeEvalMatches = proxy.match(/unsafe-eval/g) ?? [];
  assert.equal(unsafeEvalMatches.length, 1);

  const scriptSource = proxy.match(/script-src[^;]+;/)?.[0] ?? "";
  assert.ok(scriptSource);
  assert.doesNotMatch(scriptSource, /unsafe-inline/);
});

test("root layout explicitly opts into dynamic rendering for nonce injection", () => {
  const layout = read("../app/layout.tsx");
  assert.match(layout, /import \{ connection \} from "next\/server"/);
  assert.match(layout, /export default async function RootLayout/);
  assert.match(layout, /await connection\(\)/);
});
