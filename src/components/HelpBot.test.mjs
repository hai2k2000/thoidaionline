import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
test("Help launcher is desktop-only and the mobile sheet clears the safe-area navigation", () => {
  const source = read("./HelpBot.tsx");
  assert.match(source, /hidden[^"\n]*lg:flex/);
  assert.match(source, /addEventListener\("thoidai:open-help"/);
  assert.match(source, /removeEventListener\("thoidai:open-help"/);
  assert.match(source, /inset-x-0/);
  assert.match(source, /mobile-fab-offset/);
  assert.match(read("../app/globals.css"), /\.mobile-fab-offset\s*\{\s*bottom: calc\(5rem \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(source, /style=\{\{ position: "fixed" \}\}/);
  assert.match(source, /aria-label="Đóng trợ lý"/);
});

test("update banner clears mobile bottom navigation", () => {
  assert.match(read("./VersionRefresh.tsx"), /bottom-\[calc\(5rem\+env\(safe-area-inset-bottom\)\)\]/);
});
