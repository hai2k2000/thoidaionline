import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getPhase2Navigation } from "./phase2Navigation.ts";

const employee = { roleCode: "nhan_vien", departmentCode: "general", canAssignTask: false, canEvaluateStep1: false, canEvaluateStep2: false, canManageRubrics: false, canManageUsers: false, canManagePermissions: false };

test("asset navigation is permission-driven for desktop and mobile shared content", () => {
  const navigation = getPhase2Navigation({ ...employee, canViewAssets: true });
  assert.deepEqual(navigation.primary.filter((item) => item.id === "assets"), [{ id: "assets", href: "/assets" }]);
  assert.equal(navigation.primary.find((item) => item.id === "assets")?.href, "/assets");
  assert.equal(getPhase2Navigation(employee).primary.some((item) => item.id === "assets"), false);
});

test("asset screens remain server API clients and expose lifecycle concepts", () => {
  for (const path of ["../app/assets/page.tsx", "../app/assets/new/page.tsx", "../app/assets/[id]/page.tsx"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /@\/lib\/supabase|supabase\.from\(/);
    assert.match(source, /\/api\/assets|listAssets|createAsset|assignAsset/);
  }
  const detail = readFileSync(new URL("../app/assets/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(detail, /transfer|return|history|assignment/i);
});
