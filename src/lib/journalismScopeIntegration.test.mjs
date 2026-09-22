import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("server session carries department code for authoritative Journalism scope", () => {
  const source = read("./serverSession.ts");
  assert.match(source, /department_code: string \| null/);
  assert.match(source, /departments!staff_users_department_id_fkey\(code\)/);
});

test("Journalism pages and create API deny actors outside Content scope", () => {
  assert.match(read("../app/journalism/reports/page.tsx"), /canUseJournalism/);
  assert.match(read("../app/journalism/structures/page.tsx"), /canUseJournalism/);
  assert.match(read("../app/tasks/assign/page.tsx"), /canUseJournalism/);
  assert.match(read("../app/api/tasks/journalism/assign/route.ts"), /canUseJournalism/);
});

test("Journalism mutations enforce Content scope before RBAC permission", () => {
  assert.match(read("./journalismAuthorization.ts"), /canUseJournalism/);
  assert.match(read("./journalismStructureHandlers.ts"), /canUseJournalism/);
});

test("Task list and detail do not expose Journalism outside authorized scope", () => {
  assert.match(read("../app/tasks/page.tsx"), /canUseJournalism/);
  assert.match(read("../app/tasks/[id]/page.tsx"), /canUseJournalism/);
  const repository = read("./taskRepository.ts");
  assert.match(repository, /actor\.canAccessJournalism/);
  assert.match(repository, /applyJournalismExcludeFilter\(dbQuery\)/);
  assert.match(repository, /isJournalism/);
  assert.match(repository, /if \(isJournalism\) return ok\(null\)/);
});
