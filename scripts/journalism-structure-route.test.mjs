import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

for (const [file, key] of [["src/app/api/journalism/topics/route.ts", "topics"], ["src/app/api/journalism/series/route.ts", "series"]]) {
  test(`${key} route exposes an authenticated GET list contract`, () => {
    const source = readFileSync(file, "utf8");
    assert.match(source, /export async function GET/);
    assert.match(source, new RegExp(`apiJson\\(\\{ ${key}:`));
    assert.match(source, /requireReadActor/);
  });
}
