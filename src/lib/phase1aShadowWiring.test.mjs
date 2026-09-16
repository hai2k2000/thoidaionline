import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("task server boundary runs shadow comparison while legacy result remains authoritative", () => {
  const factory = readFileSync("src/lib/taskHandlerFactory.ts", "utf8");
  const handlers = readFileSync("src/lib/taskHandlers.ts", "utf8");
  assert.match(factory, /const legacyResult = deps\.canTaskAction/);
  assert.match(factory, /await deps\.shadowTaskAction\?\./);
  assert.match(factory, /return legacyResult[\s\S]*\? accessResult\.data/);
  assert.match(
    factory,
    /const legacyAssignmentResult = deps\.canAssignToDepartment[\s\S]*await deps\.shadowTaskAction\?\.[\s\S]*if \(!legacyAssignmentResult\)/,
  );
  assert.match(handlers, /loadRbacActor/);
  assert.match(handlers, /shadowAuthorize/);
  assert.match(handlers, /catch \{[\s\S]*Shadow failures never affect legacy authorization/);
});
