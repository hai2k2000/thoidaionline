import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./TaskDetailShell.tsx", import.meta.url), "utf8");

test("task detail always renders the description, independent of requirements", () => {
  const descIndex = source.indexOf('<Section title="Mô tả công việc">');
  assert.ok(descIndex > 0, "description section exists");
  const descSection = source.slice(descIndex, source.indexOf("</Section>", descIndex));
  assert.match(descSection, /task\.description \|\| "—"/);
  assert.doesNotMatch(descSection, /requirements\.length/, "description must not be gated by requirements");
});

test("requirements section renders only when requirements exist", () => {
  assert.match(source, /\{requirements\.length \? <Section title="Yêu cầu công việc">/);
});
