import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/library/page.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/SharedLibraryShell.tsx", import.meta.url), "utf8");
const view = readFileSync(new URL("../components/SharedRecordsLibrary.tsx", import.meta.url), "utf8");

test("library lists only approved public CSDL records through the actor-scoped search", () => {
  assert.match(page, /listVisibleDatabaseRecords\(user, \{ visibility: "public", status: "approved"/);
  assert.ok(page.indexOf("isCollaboratorRole") < page.indexOf("listVisibleDatabaseRecords(user"));
});

test("library root shows the shared records entry and records link to their detail page", () => {
  assert.match(page, /showSharedRecords=\{folderId === null\}/);
  assert.match(shell, /href="\/library\?view=csdl"/);
  assert.match(view, /href=\{`\/database\/records\/\$\{record\.id\}`\}/);
});
