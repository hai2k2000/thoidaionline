import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/download/workflow/route.ts", import.meta.url), "utf8");
const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");

test("workflow document download requires a signed-in employee", () => {
  assert.match(route, /requireReadActor/);
  assert.match(route, /if \(!guard\.ok\) return guard\.response/);
  assert.match(route, /private, no-store/);
});

test("workflow document is read from private runtime storage", () => {
  assert.match(route, /"storage", "workflow", "so_do_luong_cong_viec\.docx"/);
  assert.doesNotMatch(route, /"public", "uploads"/);
  assert.match(route, /apiError\("not_found", 404\)/);
});

test("legacy public document path redirects through the guarded endpoint", () => {
  assert.match(proxy, /pathname\.startsWith\("\/uploads\/"\)/);
  assert.match(proxy, /decodeURIComponent\(pathname\)/);
  assert.match(proxy, /decodedPathname === "\/uploads\/so_do_luong_cong_viec\.docx"/);
  assert.match(proxy, /new URL\("\/api\/download\/workflow", request\.url\)/);
  assert.match(proxy, /"\/uploads\/:path\*"/);
});
