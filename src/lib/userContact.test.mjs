import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
};
const route = read("../app/api/users/route.ts");
const page = read("../app/users/page.tsx");
const validation = read("./userContactValidation.ts");

test("users contact fields are selected, editable and whitelisted", () => {
  assert.match(route, /select\([^)]*phone/);
  assert.match(route, /email/);
  assert.match(route, /body\.email|email\s*:/);
  assert.match(route, /body\.phone|phone\s*:/);
  assert.match(page, /editEmail/);
  assert.match(page, /editPhone/);
  assert.match(page, /name=.*email|Email/);
  assert.match(page, /name=.*phone|SĐT|Số điện thoại/);
});

test("contact validation normalizes nullable email and safe phone", async () => {
  assert.match(validation, /validateEmail/);
  assert.match(validation, /validatePhone/);
  const validationModule = await import("./userContactValidation.ts");
  assert.equal(validationModule.validateEmail("  USER@Example.COM "), "user@example.com");
  assert.equal(validationModule.validateEmail(""), null);
  assert.equal(validationModule.validatePhone(" +84 (90) 123-4567 "), "+84 (90) 123-4567");
  assert.equal(validationModule.validatePhone("abc"), null);
});
