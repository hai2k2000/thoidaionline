import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("J5E management route is server-authorized and uses scoped loaders", () => {
  const page = read("../app/journalism/structures/page.tsx");
  const repository = read("./journalismStructureRepository.ts");
  assert.match(page, /canManageStructures/);
  assert.match(repository, /journalism\.structure\.manage/);
  assert.match(page, /loadJournalismStructurePage/);
  assert.match(repository, /department_id/);
  assert.match(repository, /canManageJournalismStructure/);
  assert.doesNotMatch(page, /role_code ===|roleCode ===/);
});

test("J5E management UI consumes same-origin mutation APIs and renders inactive history", () => {
  const shell = read("../components/JournalismStructuresShell.tsx");
  assert.match(shell, /api\/journalism\/\$\{series \? "series" : "topics"\}/);
  assert.match(shell, /archive/);
  assert.match(shell, /Ngừng sử dụng/);
  assert.doesNotMatch(shell, /restore|ownership|transfer|dangerouslySetInnerHTML/);
});

test("J5E task detail exposes association controls only through structure.assign", () => {
  const detail = read("../components/JournalismDetailSection.tsx");
  const shell = read("../components/TaskDetailShell.tsx");
  const controls = read("../components/JournalismAssociationControls.tsx");
  assert.match(detail, /topics/);
  assert.match(detail, /series/);
  assert.match(shell, /canAssign/);
  assert.match(controls, /api\/tasks\/\$\{taskId\}\/journalism\/topics/);
  assert.match(controls, /api\/tasks\/\$\{taskId\}\/journalism\/series/);
  assert.doesNotMatch(shell, /task\.journalism\.topics\.push|set.*topics.*optimistic/);
});

test("J5E Task Center keeps Topic and Series filters URL-driven and journalism-only", () => {
  const page = read("../app/tasks/page.tsx");
  const shell = read("../components/TaskCenterShell.tsx");
  const filters = read("./taskFilters.mjs");
  assert.match(page, /listJournalismStructureFilters/);
  assert.match(shell, /name="topicId"/);
  assert.match(shell, /name="seriesId"/);
  assert.match(filters, /parsedTopicId \|\| parsedSeriesId/);
  assert.match(filters, /topicId = null/);
  assert.match(filters, /seriesId = null/);
});

test("J5E ordering UI uses explicit accessible controls and complete permutation", () => {
  const shell = read("../components/JournalismSeriesOrderShell.tsx");
  assert.match(shell, /Lên/);
  assert.match(shell, /Xuống/);
  assert.match(shell, /taskIds/);
  assert.match(shell, /response\.status === 409/);
  assert.match(shell, /ngoài phạm vi bạn được xem/);
  assert.doesNotMatch(shell, /draggable=|onDrag/);
});
