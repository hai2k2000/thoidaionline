import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const snippet = readFileSync(new URL("../../deploy/nginx/thoidai-work-supa.conf", import.meta.url), "utf8");
const guard = readFileSync(new URL("./nginx-supa-buffer-guard.sh", import.meta.url), "utf8");

test("Supabase proxy buffers accommodate long scoped task response headers", () => {
  assert.match(snippet, /proxy_buffer_size 16k;/);
  assert.match(snippet, /proxy_buffers 8 16k;/);
  assert.match(snippet, /proxy_busy_buffers_size 32k;/);
  assert.match(guard, /nginx -T/);
  assert.match(guard, /proxy_buffer_size 16k/);
});
