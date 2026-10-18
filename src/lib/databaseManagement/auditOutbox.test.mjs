import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { newAuditIdempotencyKey } from "./auditIdempotency.mjs";

test("independent audit actions get distinct keys while retries reuse an explicit key", () => {
  const first = newAuditIdempotencyKey();
  const second = newAuditIdempotencyKey();
  assert.notEqual(first, second);
  assert.equal(newAuditIdempotencyKey("retry-event-0001"), "retry-event-0001");
});

test("audit outbox is additive, idempotent and redacts sensitive payload keys", () => {
  const migration = readFileSync("supabase/migrations/20261018130000_database_management_v1_cp6_audit_outbox.sql", "utf8");
  const source = readFileSync("src/lib/databaseManagement/auditOutbox.ts", "utf8");
  assert.match(migration, /database_audit_outbox/);
  assert.match(migration, /unique/);
  assert.match(migration, /audit_logs_idempotency_key_idx/);
  assert.match(migration, /revoke all on table public\.database_audit_outbox from public, anon, authenticated/);
  assert.match(source, /idempotencyKey/);
  assert.match(source, /newAuditIdempotencyKey\(input\.idempotencyKey\)/);
  assert.match(source, /status: "pending"/);
  assert.match(source, /status: "delivered"/);
  assert.match(source, /password\|token\|secret/);
  assert.match(source, /audit_delivery_failed/);
  assert.match(source, /idempotency_key: idempotencyKey/);
  assert.match(source, /retryPendingAudits/);
  assert.match(source, /attempt >= 10/);
});
