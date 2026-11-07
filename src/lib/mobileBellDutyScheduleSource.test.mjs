import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(path, "utf8");

test("white panel positioning does not override positioned utilities", () => {
  const css = read("src/app/globals.css");
  const panelRule = css.match(/:where\(\.rounded-xl\.border\.bg-white, \.rounded-2xl\.border\.bg-white, \.rounded-lg\.border\.bg-white\) \{[^}]*\}/)?.[0] ?? "";
  assert.doesNotMatch(panelRule, /position: relative/);
  assert.match(css, /:not\(\.fixed, \.absolute, \.sticky, \.lg\\:absolute/);
});

test("notification bell keeps mobile panel scrollable", () => {
  const source = read("src/components/NotificationBell.tsx");
  assert.match(source, /max-lg:overflow-y-auto lg:overflow-hidden/);
});

test("duty schedule hides empty mobile padding cells", () => {
  const source = read("src/components/DutyScheduleViewer.tsx");
  assert.match(source, /hidden md:block \$\{density\.card\}/);
  const online = read("src/components/OnlineWorkViewer.tsx");
  assert.doesNotMatch(online, /empty-\$\{index\}/);
});
