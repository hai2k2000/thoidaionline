import assert from "node:assert/strict";
import test from "node:test";
import { REQUIRED_RPCS, REQUIRED_STATUS_VALUES, REQUIRED_TABLE_COLUMNS, REQUIRED_TABLES, validateSchemaSnapshot } from "./schema-contracts.mjs";

test("schema contract names required production tables, fields, RPCs, and statuses", () => {
  assert.ok(REQUIRED_TABLES.includes("tasks"));
  assert.ok(REQUIRED_TABLE_COLUMNS.tasks.includes("approval_required"));
  assert.ok(REQUIRED_RPCS.includes("api_review_personal_work_schedule"));
  assert.ok(REQUIRED_STATUS_VALUES.includes("pending_review"));
});

test("complete schema snapshot passes and incomplete snapshot fails closed", () => {
  const complete = { tables: REQUIRED_TABLES, columns: REQUIRED_TABLE_COLUMNS, functions: REQUIRED_RPCS, taskStatuses: REQUIRED_STATUS_VALUES };
  assert.equal(validateSchemaSnapshot(complete).ok, true);
  const result = validateSchemaSnapshot({ tables: [], columns: {}, functions: [], taskStatuses: [] });
  assert.equal(result.ok, false);
  assert.ok(result.missingTables.length > 0);
  assert.ok(result.missingFunctions.length > 0);
});
