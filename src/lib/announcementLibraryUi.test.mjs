import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const files = ["../components/AnnouncementShell.tsx", "../components/SharedLibraryShell.tsx"];

test("announcement and library pages gate collaborators", () => { for (const path of ["../app/announcements/page.tsx", "../app/library/page.tsx"]) { const source = read(path); assert.ok(source.includes('redirect("/login")')); assert.ok(source.includes('redirect("/my-tasks")')); } });
test("announcement form keeps publish fields", () => { const source = read(files[0]); assert.doesNotMatch(source, /important:false/); for (const token of ["fieldImportant", "fieldPinned", "fieldExpires", 'role="alert"']) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"))); });
test("library supports upload and folder names", () => { const source = read(files[1]); for (const token of ['type="file"', "FormData", "uploadRules", "folderName"]) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"))); assert.doesNotMatch(source, /\{folderId\}/); });
test("shells keep text safe and external links noopener", () => { const sources = files.map(read); assert.doesNotMatch(sources[0], /dangerouslySetInnerHTML/); assert.match(sources[1], /noopener noreferrer/); for (const source of [...sources, read("../app/announcements/page.tsx"), read("../app/library/page.tsx")]) { assert.doesNotMatch(source, /[^\x00-\x7F]/); assert.doesNotMatch(source, /\\u/); } });
test("library repository uses null parent filter", () => assert.ok(read("./sharedLibraryRepository.ts").includes('.is("parent_id", null)')));
test("collaborators cannot access new sections", async () => { const { isCollaboratorAllowedPath } = await import("./collaboratorRole.mjs"); for (const path of ["/announcements", "/library", "/api/announcements", "/api/shared-library"]) assert.equal(isCollaboratorAllowedPath(path), false); });
test("project library fixed text", () => assert.doesNotMatch(read("../components/ProjectLibrary.tsx"), /Th\? m\?c/));
