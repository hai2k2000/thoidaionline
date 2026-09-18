import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { serializeVietnamPlannedPublication } from "./journalismCreateUi.mjs";
import { journalismLocalDateTime } from "./journalismMetadataEdit.mjs";
import { validateSchedule } from "./journalismPublicationUi.mjs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("J4B-5 keeps the four capability combinations independent and fail-closed", () => {
  const page = read("../app/tasks/[id]/page.tsx");
  const shell = read("../components/TaskDetailShell.tsx");
  const authorization = read("./journalismAuthorization.ts");
  assert.match(page, /journalism\.metadata\.update/);
  assert.match(page, /journalism\.publication\.manage/);
  assert.match(shell, /capabilities\.journalismMetadataUpdate \? <JournalismMetadataEditor/);
  assert.match(shell, /capabilities\.journalismPublicationManage \? <JournalismPublicationControls/);
  assert.match(shell, /task\.journalism && capabilities\.journalismMetadataUpdate/);
  assert.match(shell, /task\.journalism && capabilities\.journalismPublicationManage/);
  assert.match(authorization, /can\(actor, permission/);
  assert.doesNotMatch(authorization, /tong_bien_tap|pho_tong_bien_tap|truong_phong|phong_vien|nhan_vien/);
});

test("J4B-5 keeps normal Tasks free of Journalism UI and create mutation fields", () => {
  const shell = read("../components/TaskDetailShell.tsx");
  const create = read("../components/TaskAssignShell.tsx");
  assert.match(shell, /task\.journalism \?/);
  assert.match(create, /journalismMode/);
  assert.match(create, /\/api\/tasks\/journalism\/assign/);
  assert.doesNotMatch(create, /publicationStatus|publishedAt|articleUrl/);
});

test("J4B-5 uses deterministic Vietnam-local time across create, edit, and publication", () => {
  assert.equal(serializeVietnamPlannedPublication("2026-09-20", "09:30"), "2026-09-20T02:30:00.000Z");
  assert.deepEqual(journalismLocalDateTime("2026-09-20T02:30:00.000Z"), { date: "2026-09-20", time: "09:30" });
  assert.deepEqual(validateSchedule("2026-09-20", "09:30", new Date("2026-09-19T00:00:00Z")), { ok: true, value: "2026-09-20T09:30:00+07:00" });
  assert.match(read("../components/JournalismPublicationControls.tsx"), /Asia\/Ho_Chi_Minh/);
});

test("J4B-5 keeps mutation guards, conflict refresh, and no retry in the integrated shells", () => {
  const metadata = read("../components/JournalismMetadataEditor.tsx");
  const publication = read("../components/JournalismPublicationControls.tsx");
  assert.match(metadata, /busyRef\.current/);
  assert.match(metadata, /if \(busyRef\.current\) return/);
  assert.equal((metadata.match(/await fetch\(/g) ?? []).length, 1);
  assert.match(publication, /busyRef\.current/);
  assert.match(publication, /if \(!action \|\| busyRef\.current\) return/);
  assert.match(publication, /router\.refresh\(\)/);
  assert.doesNotMatch(publication, /retry|setTimeout\(|while \(/);
});

test("J4B-5 preserves payload allowlists, URL safety, CMS semantics, and no client secrets", () => {
  const create = read("./journalismCreateUi.mjs");
  const publication = read("./journalismPublicationUi.mjs");
  const controls = read("../components/JournalismPublicationControls.tsx");
  const detail = read("../components/JournalismDetailSection.tsx");
  const source = `${create}\n${publication}\n${controls}\n${detail}`;
  assert.doesNotMatch(source, /publishedAt|actorId|expectedUpdatedAt|etag|version/);
  assert.match(publication, /status: "scheduled", plannedPublicationAt/);
  assert.match(publication, /status: "published", articleUrl/);
  assert.match(publication, /status: "withdrawn", reason/);
  assert.match(detail, /target="_blank"/);
  assert.match(detail, /rel="noreferrer"/);
  assert.match(controls, /không thao tác trực tiếp trên CMS/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|service_role|dangerouslySetInnerHTML|createClient|\.rpc\(/);
});

test("J4B-5 keeps list/detail server-shaped and avoids Journalism N+1 fetches", () => {
  const list = read("../components/JournalismSummary.tsx");
  const detail = read("../components/TaskDetailShell.tsx");
  assert.doesNotMatch(list, /fetch\(|useEffect\(|createClient/);
  assert.match(detail, /journalismWorkKinds/);
  assert.match(detail, /task\.journalism \?/);
});
