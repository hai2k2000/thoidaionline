import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(new URL("./taskRepository.ts", import.meta.url), "utf8");

function detailJournalismSelect() {
  const block = repository.match(/const TASK_DETAIL_FIELDS = \[([\s\S]*?)\]\.join\(","\);/);
  assert.ok(block, "TASK_DETAIL_FIELDS must exist");
  const literal = [...block[1].matchAll(/^\s*("(?:[^"\\]|\\.)*"),?$/gm)]
    .map((match) => JSON.parse(match[1]))
    .find((field) => field.startsWith("journalism:journalism_task_details("));
  assert.ok(literal, "Journalism detail relation must exist");
  return literal;
}

function splitSelectFields(select) {
  const fields = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < select.length; index += 1) {
    if (select[index] === "(") depth += 1;
    if (select[index] === ")") {
      depth -= 1;
      assert.ok(depth >= 0, "PostgREST relation syntax closes before it opens");
    }
    if (select[index] === "," && depth === 0) {
      fields.push(select.slice(start, index));
      start = index + 1;
    }
  }
  assert.equal(depth, 0, "PostgREST relation syntax must be balanced");
  fields.push(select.slice(start));
  return fields;
}

function parseSelect(select) {
  return splitSelectFields(select).map((field) => {
    const open = field.indexOf("(");
    if (open < 0) return { name: field, children: [] };
    assert.equal(field.at(-1), ")", `relation ${field.slice(0, open)} must close`);
    return { name: field.slice(0, open), children: parseSelect(field.slice(open + 1, -1)) };
  });
}

test("Task detail PostgREST select balances J6D and J6E nested relations", () => {
  const fields = parseSelect(detailJournalismSelect());
  const journalism = fields.find((field) => field.name === "journalism:journalism_task_details");
  assert.ok(journalism);
  const report = journalism.children.find((field) => field.name === "publication_report:journalism_publication_reports");
  assert.ok(report);
  assert.ok(report.children.some((field) => field.name === "reporter:staff_users!journalism_publication_reports_reported_by_fkey"));
  const history = report.children.find((field) => field.name === "verification_history:journalism_publication_verifications");
  assert.ok(history);
  assert.ok(history.children.some((field) => field.name === "verifier:staff_users!journalism_publication_verifications_verified_by_fkey"));
});

test("Task detail keeps absent Journalism reports optional", () => {
  const validation = readFileSync(new URL("./journalismManualPublicationValidation.ts", import.meta.url), "utf8");
  assert.match(validation, /if \(!value \|\| typeof value !== "object"\) return null/);
  const contracts = readFileSync(new URL("./taskContracts.ts", import.meta.url), "utf8");
  assert.match(contracts, /verification_history: JournalismPublicationVerificationDto\[\]/);
});

test("Task detail accepts a Journalism report with zero verification rows", () => {
  const validation = readFileSync(new URL("./journalismManualPublicationValidation.ts", import.meta.url), "utf8");
  assert.match(validation, /const history = \(Array\.isArray\(row\.verification_history\) \? row\.verification_history :/);
  assert.match(validation, /history\.length > 0 \? "stale" : "unverified"/);
});
