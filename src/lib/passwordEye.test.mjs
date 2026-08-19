import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const files = ["../app/login/page.tsx", "../app/reset-password/page.tsx", "../app/users/page.tsx"].map(read);

test("all password entry screens use accessible password visibility controls", () => {
  for (const source of files) {
    assert.match(source, /PasswordInput/);
  }
});

test("password visibility component toggles only password/text and preserves controls", () => {
  const source = read("../components/PasswordInput.tsx");
  assert.match(source, /type=\{visible \? \"text\" : \"password\"\}/);
  assert.match(source, /type=\"button\"/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /disabled/);
});
