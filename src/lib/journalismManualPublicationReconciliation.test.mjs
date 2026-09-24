import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("reconciliation route authenticates, reuses scoped manage permission, and derives actor", () => {
  const route = read("../app/api/tasks/[id]/journalism/publication-reconciliation/route.ts");
  assert.match(route, /requireMutationActor/);
  assert.match(route, /taskRepository\.access/);
  assert.match(route, /journalism\.publication\.manage/);
  assert.match(route, /p_actor_id: guard\.actor\.id/);
  assert.match(route, /api_reconcile_journalism_publication_report_v1/);
  assert.doesNotMatch(route, /reportedBy|reported_by|cms_content_id|mastercms/);
});

test("reconciliation payload requires a current version and bounded reason", () => {
  const validation = read("./journalismPublicationReconciliationValidation.ts");
  assert.match(validation, /parseManualPublicationReconciliation/);
  assert.match(validation, /expectedUpdatedAt/);
  assert.match(validation, /reason/);
  assert.match(validation, /bounded\(body\.reason, 2000\)/);
  assert.match(validation, /!publicationUrl \|\| !publishedAt \|\| !expectedUpdatedAt/);
});

test("reconciliation migration locks one report, rejects no-op/stale writes, and audits changes", () => {
  const migration = read("../../supabase/migrations/20260922130000_journalism_manual_publication_reconciliation.sql");
  assert.match(migration, /api_reconcile_journalism_publication_report_v1/);
  assert.match(migration, /api_assert_journalism_access/);
  assert.match(migration, /journalism\.publication\.manage/);
  assert.match(migration, /for update/);
  assert.match(migration, /errcode = '40001'/);
  assert.match(migration, /Reconciliation did not change/);
  assert.match(migration, /reconcile_manual_publication_report/);
  assert.match(migration, /reconciliation_reason_length/);
});

test("reconciliation preserves report identity, original reporter, and append-only verification history", () => {
  const migration = read("../../supabase/migrations/20260922130000_journalism_manual_publication_reconciliation.sql");
  assert.match(migration, /update public\.journalism_publication_reports/);
  assert.doesNotMatch(migration, /reported_by\s*=\s*p_actor_id/);
  assert.doesNotMatch(migration, /journalism_publication_verifications/);
  assert.doesNotMatch(migration, /insert into public\.journalism_publication_verifications/);
});

test("reconciliation remains Work-owned and disconnected from MasterCMS and unrelated modules", () => {
  const migration = read("../../supabase/migrations/20260922130000_journalism_manual_publication_reconciliation.sql");
  const route = read("../app/api/tasks/[id]/journalism/publication-reconciliation/route.ts");
  assert.doesNotMatch(`${migration}\n${route}`, /MasterCMS|mastercms|cms_content_id|provider_status|personal_plan|event_assignment|online_work/i);
});

test("reconciliation UI is a separate intentional action with a reason and optimistic version", () => {
  const component = read("../components/JournalismManualPublicationReport.tsx");
  assert.match(component, /journalismLabels.reconciliation/);
  assert.match(component, /publication-reconciliation/);
  assert.match(component, /reconciliationReason/);
  assert.match(component, /expectedUpdatedAt: report\?\.updated_at/);
  assert.doesNotMatch(component, /DELETE|delete\(/);
});
