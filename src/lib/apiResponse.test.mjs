import assert from "node:assert/strict";
import test from "node:test";

import { apiError, apiJson } from "./apiResponse.ts";

test("JSON responses are private no-store at runtime", async () => {
  const response = apiJson({ ok: true });
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("cache-control") ?? "",
    /private, no-store/,
  );
  assert.deepEqual(await response.json(), { ok: true });
});

test("stable errors inherit private no-store headers", async () => {
  const response = apiError("forbidden", 403);
  assert.equal(response.status, 403);
  assert.match(
    response.headers.get("cache-control") ?? "",
    /private, no-store/,
  );
  assert.deepEqual(await response.json(), { error: { code: "forbidden" } });
});
