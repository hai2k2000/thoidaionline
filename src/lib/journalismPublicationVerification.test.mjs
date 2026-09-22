import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("verification payload is allowlisted, bounded, and requires a rejection reason", () => {
  const validation = read("./journalismPublicationVerificationValidation.ts");
  assert.match(validation, /const allowed = \["decision", "note", "expectedReportUpdatedAt"\]/);
  assert.match(validation, /body\.decision !== "verified" && body\.decision !== "rejected"/);
  assert.match(validation, /body\.decision === "rejected" && !note/);
  assert.match(validation, /5000/);
  assert.doesNotMatch(validation, /verified_by|reviewer_id|actor_id/);
});

test("verification route authenticates, checks scoped permission, and derives actor from session", () => {
  const route = read("../app/api/tasks/[id]/journalism/publication-verification/route.ts");
  assert.match(route, /requireMutationActor/);
  assert.match(route, /taskRepository\.access/);
  assert.match(route, /journalism\.publication\.verify/);
  assert.match(route, /p_actor_id: guard\.actor\.id/);
  assert.match(route, /api_record_journalism_publication_verification_v1/);
  assert.doesNotMatch(route, /verified_by|reviewer_id|actor_id:\s*value/);
});

test("verification migration is additive, append-only, scoped, and auditable", () => {
  const migration = read("../../supabase/migrations/20260919120000_journalism_publication_verification.sql");
  assert.match(migration, /journalism\.publication\.verify/);
  assert.match(migration, /create table public\.journalism_publication_verifications/);
  assert.match(migration, /publication_report_updated_at timestamptz not null/);
  assert.match(migration, /decision in \('verified', 'rejected'\)/);
  assert.match(migration, /decision = 'verified' or \(note is not null/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.journalism_publication_verifications from public, anon, authenticated/);
  assert.match(migration, /grant select, insert on table public\.journalism_publication_verifications to service_role/);
  assert.match(migration, /for update/);
  assert.match(migration, /v_report\.reported_by = p_actor_id/);
  assert.match(migration, /errcode = '40001'/);
  assert.match(migration, /journalism_publication_verified/);
  assert.match(migration, /journalism_publication_rejected/);
  assert.doesNotMatch(migration, /grant .*update.*journalism_publication_verifications/);
  assert.doesNotMatch(migration, /grant .*delete.*journalism_publication_verifications/);
});

test("NOWAIT concurrency fix is delivered as a minimal replacement migration", () => {
  const migration = read("../../supabase/migrations/20260922150000_journalism_publication_verification_nowait.sql");
  assert.match(migration, /create or replace function public\.api_record_journalism_publication_verification_v1/);
  assert.match(migration, /for update nowait/i);
  assert.doesNotMatch(migration, /create table|drop table|truncate|delete from/i);
});

test("current, stale, and append-only history states are derived from report versions", () => {
  const validation = read("./journalismManualPublicationValidation.ts");
  assert.match(validation, /history\.find\(\(entry\) => entry\.isCurrent\)/);
  assert.match(validation, /history\.length > 0 \? "stale" : "unverified"/);
  assert.match(validation, /publication_report_updated_at/);
  assert.match(validation, /isCurrent:/);
  assert.match(validation, /sort\(\(left, right\) => right\.created_at/);
  const contracts = read("./taskContracts.ts");
  assert.match(contracts, /JournalismPublicationVerificationStatus = "unverified" \| "verified" \| "rejected" \| "stale"/);
  assert.match(contracts, /verification_history: JournalismPublicationVerificationDto\[\]/);
});

test("Task detail blocks self-verification and passes the independent verifier capability", () => {
  const page = read("../app/tasks/[id]/page.tsx");
  const shell = read("../components/TaskDetailShell.tsx");
  assert.match(page, /publication_report\?\.reported_by !== user\.id/);
  assert.match(page, /journalism\.publication\.verify/);
  assert.match(page, /journalismPublicationVerify/);
  assert.match(shell, /canVerify=\{capabilities\.journalismPublicationVerify\}/);
});

test("verification UI renders labels/history, sends expected version, and refreshes on conflict", () => {
  const component = read("../components/JournalismManualPublicationReport.tsx");
  assert.match(component, /Chưa xác minh/);
  assert.match(component, /Đã xác minh/);
  assert.match(component, /Bị từ chối/);
  assert.match(component, /Cần xác minh lại/);
  assert.match(component, /Xác nhận/);
  assert.match(component, /Từ chối/);
  assert.match(component, /verification_history/);
  assert.match(component, /expectedReportUpdatedAt: report\.updated_at/);
  assert.match(component, /response\.status === 409/);
  assert.match(component, /verificationBusyRef\.current/);
  assert.match(component, /disabled=\{verificationBusy\}/);
  assert.match(component, /router\.refresh\(\)/);
  assert.doesNotMatch(component, /MasterCMS|cms_content_id|fetch\(report\.publication_url/);
});

test("J6E documentation keeps the MasterCMS boundary and deferred checkpoints explicit", () => {
  const report = read("../../JOURNALISM_J6E_PUBLICATION_VERIFICATION_AUDIT.md");
  assert.match(report, /J6B remains \*\*NO-GO\*\*/);
  assert.match(report, /J6C remains \*\*NO-GO\*\*/);
  assert.match(report, /MasterCMS is completely disconnected/);
  assert.match(report, /production has not received this migration/i);
});
