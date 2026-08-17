import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { resolveTaskCompatibility } from "./taskCompatibility.ts";

const base = {
  task_type: null,
  plan_period: "daily",
  self_claimable: true,
  owner_id: null,
  assignee_id: null,
  task_assignees: [],
};

test("explicit canonical task types are writable", () => {
  assert.deepEqual(resolveTaskCompatibility({
    ...base,
    task_type: "assigned",
  }), {
    compatibility_task_type: "assigned",
    legacy_read_only: false,
  });
});

test("legacy ad-hoc assignments remain readable through the adapter", () => {
  assert.deepEqual(resolveTaskCompatibility({
    ...base,
    plan_period: "ad_hoc",
    self_claimable: false,
  }), {
    compatibility_task_type: "assigned",
    legacy_read_only: true,
  });
});

test("legacy plan ownership includes participant rows and monthly plans", () => {
  assert.deepEqual(resolveTaskCompatibility({
    ...base,
    plan_period: "monthly",
    task_assignees: [{ assignment_role: "assignee" }],
  }), {
    compatibility_task_type: "personal",
    legacy_read_only: true,
  });
});

test("unclaimed legacy plans stay untyped and read-only", () => {
  assert.deepEqual(resolveTaskCompatibility(base), {
    compatibility_task_type: null,
    legacy_read_only: true,
  });
});

test("Phase 3 migration is additive and exposes a security-invoker adapter", () => {
  const migration = fs.readFileSync(
    new URL("../../supabase/migrations/20260817050000_phase3_additive_task_schema.sql", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(migration, /\bdrop\s+(?:table|schema|database)\b/i);
  assert.doesNotMatch(migration, /\bdrop\s+column\b/i);
  assert.doesNotMatch(migration, /\btruncate\b/i);
  assert.doesNotMatch(migration, /\bdelete\s+from\b/i);
  assert.doesNotMatch(migration, /\balter\s+column\b[^;]*\btype\b/i);
  assert.match(migration, /create or replace view public\.task_compatibility_v1\s+with \(security_invoker=true\)/i);
  assert.match(migration, /from public, anon, authenticated/i);
  assert.match(migration, /grant select on table public\.task_compatibility_v1 to service_role/i);
  assert.match(migration, /t\.plan_period in \('daily','weekly','monthly'\)[\s\S]*exists \([\s\S]*public\.task_assignees/i);
});