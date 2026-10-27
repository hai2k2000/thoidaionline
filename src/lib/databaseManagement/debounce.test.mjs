import assert from "node:assert/strict";
import test from "node:test";
import { debounce } from "./debounce.mjs";

test("debounce invokes only the final call", async () => {
  const calls = [];
  const run = debounce((value) => calls.push(value), 10);
  run("a"); run("b");
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.deepEqual(calls, ["b"]);
});
