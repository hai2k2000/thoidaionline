import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const migrationPath = new URL("../../supabase/migrations/20261029090000_business_rule_errcode_55000.sql", import.meta.url);
const revertPath = new URL("../../scripts/revert/20261029090000_business_rule_errcode_55000.revert.sql", import.meta.url);

const md5 = (value) => createHash("md5").update(value).digest("hex");
const functionStatements = (source) => [...source.matchAll(/^CREATE OR REPLACE FUNCTION[\s\S]*?^(?:end )?\$function\$;\r?\n?/gim)]
  .map(({ 0: statement }) => statement.replace(/;\r?\n?$/, "\n"));
const functionIdentity = (statement) => {
  const match = statement.match(/^CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)\(([^)]*)\)/i);
  assert.ok(match, "function statement must expose its public identity");
  return `${match[1]}(${match[2].replace(/\s+DEFAULT\s+[^,]+(?=,|$)/g, "")})`;
};
const guardRows = (source) => [...source.matchAll(/^\s*SELECT '([^']+)', md5\(.*\), '([0-9a-f]{32})'$/gm)]
  .map(([, name, expectedMd5]) => ({ name, expectedMd5 }));
const replaceErrcodeTokens = (value) => value.replace(/(errcode\s*=\s*)'40001'/g, "$1'55000'");

test("business errcode SQL terminates every function definition", () => {
  for (const filePath of [migrationPath, revertPath]) {
    const source = readFileSync(filePath, "utf8");
    const functionCount = (source.match(/CREATE OR REPLACE FUNCTION/g) ?? []).length;
    const terminatedFunctionCount = (source.match(/^[^\r\n]*\$function\$;\r?$/gm) ?? []).length;
    assert.equal(terminatedFunctionCount, functionCount, `${filePath} function delimiter count mismatch`);
  }
});

test("business errcode migration matches every live pre-image and revert", () => {
  assert.equal(existsSync(migrationPath), true, "migration must exist");
  assert.equal(existsSync(revertPath), true, "revert must exist");
  const migration = readFileSync(migrationPath, "utf8");
  const revert = readFileSync(revertPath, "utf8");
  const preImages = functionStatements(revert);
  const expectedRows = guardRows(migration);
  const expectedByName = new Map(expectedRows.map((row) => [row.name, row.expectedMd5]));
  const preImagesByName = new Map(preImages.map((preImage) => [functionIdentity(preImage), preImage]));

  assert.equal(preImages.length, 16, "revert must contain exactly 16 pre-images");
  assert.equal(expectedRows.length, 16, "migration guard must contain exactly 16 expected rows");
  assert.deepEqual([...preImagesByName.keys()].sort(), [...expectedByName.keys()].sort(), "pre-image and guard function identities must match");
  assert.doesNotMatch(migration, /errcode\s*=\s*'40001'/, "forward migration must not retain business 40001 tokens");

  let replacedTokenCount = 0;
  for (const [name, preImage] of preImagesByName) {
    assert.equal(md5(preImage), expectedByName.get(name), `${name} pre-image md5 mismatch`);
    assert.match(preImage, /'40001'/, `${name} pre-image must contain a 40001 token`);
    replacedTokenCount += (preImage.match(/'40001'/g) ?? []).length;
    assert.equal(migration.includes(`${replaceErrcodeTokens(preImage).replace(/\r?\n$/, "")};`), true, `${name} migration does not contain exact post-image`);
  }

  assert.equal(replacedTokenCount, 18, "exactly 18 business errcode tokens must be replaced");
  for (const excludedName of ["api_review_leave_request", "api_review_personal_work_schedule"]) {
    assert.doesNotMatch(migration, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${excludedName}\\(`));
    assert.doesNotMatch(revert, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${excludedName}\\(`));
  }
});
