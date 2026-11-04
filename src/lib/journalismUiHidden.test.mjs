import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { parseTaskListSearchParams, taskListHref } from "./taskFilters.mjs";

const id = "11111111-1111-4111-8111-111111111111";
test("hidden journalism URL filters cannot silently narrow the task list", () => {
  const query = parseTaskListSearchParams(new URLSearchParams({ journalism: "only", workKind: id, topicId: id, seriesId: id, publicationStatus: "published", plannedFrom: "2026-10-01", plannedTo: "2026-10-31" }));
  assert.equal(query.journalism, null);
  assert.equal(query.journalismWorkKindId, null);
  assert.equal(query.publicationStatus, null);
  assert.equal(query.plannedPublicationFrom, null);
  assert.equal(query.plannedPublicationTo, null);
  assert.equal(query.topicId ?? null, null);
  assert.equal(query.seriesId ?? null, null);
  assert.doesNotMatch(taskListHref(query, { page: 2 }), /journalism|workKind|topicId|seriesId|planned|publication/);
});
test("project filter accepts UUID and none, rejects invalid values and persists through pagination", () => {
  for (const value of [id, "none"]) {
    const query = parseTaskListSearchParams(new URLSearchParams({ projectId: value }));
    assert.equal(query.projectId, value);
    assert.match(taskListHref(query, { page: 2 }), new RegExp(`projectId=${value}.*page=2`));
  }
  for (const value of ["bad", "null", "", "none,project_id.not.is.null"]) {
    assert.equal(parseTaskListSearchParams(new URLSearchParams({ projectId: value })).projectId ?? null, null);
  }
});
test("flag-off parsing preserves journalism mode and subfilters", () => {
  const query = parseTaskListSearchParams(new URLSearchParams({ journalism: "only", workKind: id }), { journalismUiHidden: false });
  assert.equal(query.journalism, "only");
  assert.equal(query.journalismWorkKindId, id);
});
test("repository project predicates remain additional to task authorization", () => {
  const source = readFileSync(new URL("./taskRepository.ts", import.meta.url), "utf8");
  assert.match(source, /getTaskScopeTerms\(actor\)/);
  assert.match(source, /query\.projectId === "none"[\s\S]*?\.is\("project_id", null\)/);
  assert.match(source, /\.eq\("project_id", query\.projectId\)/);
});

test("UI uses the shared switch for navigation, filters, creation and summaries", () => {
  const read = (path) => readFileSync(path, "utf8");
  assert.match(read("src/components/phase2Navigation.ts"), /!JOURNALISM_UI_HIDDEN && canAccessJournalism/);
  const shell = read("src/components/TaskCenterShell.tsx");
  assert.match(shell, /!JOURNALISM_UI_HIDDEN && basePath === "\/tasks"/);
  assert.match(shell, /!JOURNALISM_UI_HIDDEN && task.journalism/);
  assert.match(shell, /projects=\{projects\}/);
  assert.match(shell, /name="projectId"/);
  assert.match(read("src/components/TaskAssignShell.tsx"), /!JOURNALISM_UI_HIDDEN && journalismMode && <form/);
});

test("the same navigation restores all journalism links when the flag is off", async () => {
  const source = readFileSync("src/components/phase2Navigation.ts", "utf8");
  for (const hidden of [true, false]) {
    const transformed = source.replace(/^import .*;$/gm, "")
      .replace(/^\/\/ @ts-expect-error.*$/gm, "");
    const js = ts.transpileModule(transformed, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
    const navigationModule = await import(`data:text/javascript;base64,${Buffer.from(`const JOURNALISM_UI_HIDDEN = ${hidden}; const isCollaboratorRole = () => false; const PAUSED_WORK_REPORT_NAV_IDS = []; const WORK_REPORTS_PAUSED = false;\n${js}`).toString("base64")}`);
    const navigation = navigationModule.getPhase2Navigation({ roleCode: "tong_bien_tap", canAccessJournalism: true, canManageJournalismStructures: true });
    assert.deepEqual(navigation.journalism.map(item => item.id), hidden ? [] : ["journalism-tasks", "journalism-calendar", "journalism-reports", "journalism-structures"]);
  }
});

test("project query predicates use null or equality without replacing scope", () => {
  const source = readFileSync("src/lib/taskRepository.ts", "utf8");
  const predicates = source.match(/if \(query.projectId === "none"\)[\s\S]*?else if \(query.projectId\)[^;]+;/)[0];
  for (const projectId of [id, "none", undefined]) {
    const calls = [];
    const builder = { is: (...args) => { calls.push(["is", ...args]); return builder; }, eq: (...args) => { calls.push(["eq", ...args]); return builder; } };
    new Function("query", "dbQuery", predicates)({ projectId }, builder);
    assert.deepEqual(calls, projectId === "none" ? [["is", "project_id", null]] : projectId ? [["eq", "project_id", id]] : []);
  }
});

test("legacy status routes preserve the project filter and use the shared task center", () => {
  for (const route of ["active", "done", "pending-review"]) {
    const source = readFileSync(`src/app/tasks/${route}/page.tsx`, "utf8");
    assert.match(source, /buildLegacyTaskRedirectFromParams/);
    assert.match(source, /await searchParams/);
  }
  const page = readFileSync("src/app/tasks/page.tsx", "utf8");
  assert.match(page, /projectRepository.list\(projectReader\(user\)\)/);
  assert.match(page, /Number\(a.status === "closed"\) - Number\(b.status === "closed"\)/);
  const shell = readFileSync("src/components/TaskCenterShell.tsx", "utf8");
  assert.match(shell, /name="state"[^>]*onChange=/);
  assert.match(shell, /legacyStatus\.disabled = true/);
});
