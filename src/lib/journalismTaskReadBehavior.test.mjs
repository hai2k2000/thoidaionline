import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync("src/lib/taskRepository.ts", "utf8");
const handlers = readFileSync("src/lib/taskHandlerFactory.ts", "utf8");

test("Journalism relation filters use an inner parent-row join", () => {
  assert.match(repository, /journalism_task_details\$\{inner \? "!inner" : ""\}/);
  assert.match(repository, /journalism_task_details\.work_kind_id/);
  assert.match(repository, /journalism_task_details\.publication_status/);
  assert.match(repository, /journalism_task_details\.planned_publication_at/);
});

test("Journalism detail remains behind the parent Task view guard", () => {
  assert.match(handlers, /taskGuard\(guard\.actor, taskId, "view"\)[\s\S]{0,260}repository\.detail\(taskId\)/);
  assert.doesNotMatch(handlers, /journalism_task_details\/[/:]id/i);
});

test("Repository keeps server-side pagination after Journalism filters", () => {
  assert.match(repository, /\.range\(from, to\)/);
  const rangeIndex = repository.indexOf("const { data, error, count } = await dbQuery.range(from, to);");
  const enrichIndex = repository.indexOf("const enriched = await enrichJournalismList(normalizedItems);");
  assert.ok(rangeIndex >= 0, "repository must apply the requested page range in the database query");
  assert.ok(enrichIndex > rangeIndex, "Journalism enrichment must happen after server-side pagination");
});
