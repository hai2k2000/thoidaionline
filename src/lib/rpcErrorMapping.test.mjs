import assert from "node:assert/strict";
import test from "node:test";

import { mapRpcError } from "./rpcErrorMapping.ts";

test("serialization failures map to HTTP 409 across Supabase error shapes", () => {
  assert.deepEqual(mapRpcError({ code: "40001" }), { code: "conflict", status: 409 });
  assert.deepEqual(mapRpcError({ details: "40001" }), { code: "conflict", status: 409 });
  assert.deepEqual(
    mapRpcError({ message: "Publication report changed before verification." }),
    { code: "conflict", status: 409 },
  );
});

test("self-verification and validation keep their existing status codes", () => {
  assert.deepEqual(mapRpcError({ code: "42501" }), { code: "forbidden", status: 403 });
  assert.deepEqual(mapRpcError({ code: "22023" }), { code: "invalid_request", status: 400 });
  assert.deepEqual(mapRpcError({ code: "22008" }), { code: "invalid_request", status: 400 });
});

test("unexpected database failures remain HTTP 500", () => {
  assert.deepEqual(
    mapRpcError({ code: "XX000", message: "unexpected" }),
    { code: "operation_failed", status: 500 },
  );
});
