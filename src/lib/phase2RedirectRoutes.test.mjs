import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { buildLegacyTaskRedirectFromParams } from "../components/phase2Navigation.ts";

const routeFiles = {
  "/": "../app/page.tsx",
  "/tasks/active": "../app/tasks/active/page.tsx",
  "/tasks/pending-review": "../app/tasks/pending-review/page.tsx",
  "/tasks/done": "../app/tasks/done/page.tsx",
  "/my-tasks": "../app/my-tasks/page.tsx",
  "/planning": "../app/planning/page.tsx",
  "/performance": "../app/performance/page.tsx",
};

test("redirect helper preserves repeated search parameters", () => {
  assert.equal(
    buildLegacyTaskRedirectFromParams("/tasks/active", {
      tag: ["a", "b"],
      page: "2",
      status: "done",
    }),
    "/tasks?tag=a&tag=b&page=2&status=active",
  );
});

test("every legacy page uses a temporary server redirect helper", () => {
  for (const [route, relativePath] of Object.entries(routeFiles)) {
    const source = fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /redirect\(buildLegacyTaskRedirectFromParams\(/, route);
    assert.doesNotMatch(source, /@\/lib\/supabase/, route);
  }
});

test("Department Plan reports are now a canonical read-only route", () => {
  const source = fs.readFileSync(new URL("../app/planning/reports/page.tsx", import.meta.url), "utf8");
  assert.match(source, /DepartmentPlanReport/);
  assert.doesNotMatch(source, /buildLegacyTaskRedirectFromParams/);
});

test("successful login replaces history with Task Center", () => {
  const source = fs.readFileSync(
    new URL("../app/login/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /router\.replace\("\/tasks"\)/);
  assert.doesNotMatch(source, /router\.(?:push|replace)\("\/"\)/);
});

test("login submits when Enter is pressed in the credential form", () => {
  const source = fs.readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8");
  assert.match(source, /<form[\s\S]*onSubmit=\{\(event\) => \{ event\.preventDefault\(\); void submit\(\); \}\}/);
  assert.match(source, /<button type="submit"[\s\S]*Đăng nhập/);
});
