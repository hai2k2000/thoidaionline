import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (name) =>
  readFile(new URL(`./${name}`, import.meta.url), "utf8");

test("shared shells preserve a bounded responsive layout", async () => {
  const [center, detail, assign] = await Promise.all([
    source("TaskCenterShell.tsx"),
    source("TaskDetailShell.tsx"),
    source("TaskAssignShell.tsx"),
  ]);
  for (const content of [center, detail, assign]) {
    assert.match(content, /max-w-\[1500px\]/);
    assert.match(content, /flex-col[^"]*lg:flex-row/);
  }
});

test("task center avoids the cramped tablet table and filter grid", async () => {
  const center = await source("TaskCenterShell.tsx");
  assert.match(center, /lg:grid-cols-3 xl:grid-cols-4/);
  assert.match(center, /min-w-\[1120px\]/);
  assert.match(center, /space-y-3 lg:hidden/);
});

test("detail localizes every active workflow status", async () => {
  const detail = await source("TaskDetailShell.tsx");
  assert.match(detail, /blocked: "Có vướng mắc"/);
  assert.match(detail, /waiting: "Chờ phối hợp"/);
});
