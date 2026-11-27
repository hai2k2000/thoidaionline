import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { validateDatabaseRecordInput, validateDatabaseRecordUpdateInput } from "./validation.ts";

const read = (path) => readFileSync(path, "utf8");
const prefix = "supabase/migrations/";
const sourceName = "20261102140000_database_management_v1_p2_restricted_groups.sql";
const source = read(prefix + sourceName);
const media = read(prefix + "20261127130000_database_management_v1_media_group.sql");
const links = read(prefix + "20261127140000_database_management_v1_link_titles.sql");
const editorsName = "20261127150000_database_management_v1_category_editors.sql";
const editors = read(prefix + editorsName);
const revert = read("scripts/production/database-management-category-editors-revert.sql");
const repository = read("src/lib/databaseManagement/repository.ts");
const functionBody = (sql) => sql.match(/create or replace function public\.api_search_database_records\([\s\S]*?\$function\$;/)[0];
const clause = " or exists (select 1 from public.db_category_editors e where e.user_id = p_actor_id and e.category_id = c.category_id)";

test("search copy changes only non-restricted visibility and revert restores exact definition", () => {
  assert.equal(functionBody(editors).split(clause).length, 2);
  assert.equal(functionBody(editors).replace(clause, ""), functionBody(source));
  assert.equal(functionBody(revert), functionBody(source));
  for (const name of readdirSync(prefix).filter((name) => name > sourceName && name !== editorsName)) {
    assert.doesNotMatch(read(prefix + name), /create\s+or\s+replace\s+function\s+public\.api_search_database_records/i, name);
  }
});

test("media migration copies every field including hidden record code and has safe revert", () => {
  assert.match(media, /null,'anh_video','Ảnh, video',null,false,true,60/);
  assert.match(media, /'thu_vien_anh_video','Ảnh, video',true,10/);
  assert.match(media, /max\(version\)\+1/);
  assert.match(media, /not exists .*status='published'/);
  assert.match(media, /ff\.validation,ff\.sort_order,ff\.hidden/);
  assert.doesNotMatch(media, /select f\.\*/);
  assert.match(media, /'title','status','record_code'/);
  assert.match(media, /do \$assert\$/);
  assert.ok(media.indexOf("status <> 'deleted'") < media.indexOf("set active=false"));
  const rollback = read("scripts/production/database-management-media-group-revert.sql");
  assert.match(rollback, /status <> 'deleted'/);
  assert.match(rollback, /status='retired'/);
  assert.doesNotMatch(rollback, /delete from/i);
});

test("links and editors migration security and idempotent constraints", () => {
  assert.match(links, /drop constraint if exists db_record_external_links_provider_check/);
  assert.match(links, /provider in \('google_drive','web'\)/);
  assert.match(links, /label is null or length\(label\) <= 200/);
  assert.match(links, /position integer not null default 0/);
  assert.match(editors, /enable row level security/);
  assert.match(editors, /revoke all on table public.db_category_editors from public,anon,authenticated/);
  assert.match(editors, /grant select on table public.db_category_editors to service_role/);
  assert.match(editors, /where c.code='anh_video' and exists/);
  assert.match(editors, /do \$assert\$/);
  assert.match(read("scripts/production/database-management-link-titles-revert.sql"), /provider='web'.*raise exception/);
});

for (const [name, validate] of [
  ["create", (input) => validateDatabaseRecordInput({ categoryId: "11111111-1111-4111-8111-111111111111", recordTypeId: "22222222-2222-4222-8222-222222222222", title: "Media", metadata: {}, ...input })],
  ["update", validateDatabaseRecordUpdateInput],
]) {
  test(`${name} validates and trims labeled HTTPS links`, () => {
    const link = { provider: "web", url: "https://any.example:8443/video", label: "  Video  " };
    const valid = validate({ externalLinks: [link] });
    assert.equal(valid.ok, true);
    assert.equal(valid.value.externalLinks[0].label, "Video");
    for (const patch of [{ url: "http://example.test" }, { url: "https://user:pass@example.test" }, { label: " " }, { label: "x".repeat(201) }, { url: "https://example.test/" + "x".repeat(2000) }, { provider: "google_drive" }]) {
      assert.equal(validate({ externalLinks: [{ ...link, ...patch }] }).ok, false);
    }
    assert.equal(validate({ externalLinks: Array(30).fill(link) }).ok, true);
    assert.equal(validate({ externalLinks: Array(31).fill(link) }).ok, false);
    assert.equal(validate({ externalLinks: [{ ...link, provider: "google_drive", url: "https://drive.google.com/file/d/a" }] }).ok, true);
  });
}

test("omitted update links stay omitted and export uses labeled detail", () => {
  assert.equal(Object.hasOwn(validateDatabaseRecordUpdateInput({ title: "Changed" }).value, "externalLinks"), false);
  assert.match(repository, /if \(nextLinks !== undefined\)/);
  assert.match(repository, /label: link.label.trim\(\), position/);
  assert.match(repository, /order\("position", \{ ascending: true \}\).order\("created_at", \{ ascending: true \}\)/);
  assert.match(read("src/app/api/database/records/[id]/export/route.ts"), /externalLinks: detail.externalLinks/);
});

test("status retention covers admin/editor and pending creator/owner only", async () => {
  const code = stripTypeScriptTypes(repository).replace(/^import .*;\r?\n/gm, "").replace(/export /g, "");
  const evaluate = new Function("serverSupabase", `${code}; return editKeepsStatus;`);
  const client = { from(table) { const query = { select() { return query; }, eq() { return query; }, async maybeSingle() { return { data: table === "db_categories" ? { restricted: false } : null, error: null }; } }; return query; } };
  const keeps = evaluate(client);
  const actor = { id: "actor", role_code: "staff" };
  for (const status of ["draft", "pending_review", "approved", "archived"]) {
    const record = { category_id: "category", status, created_by: "creator", owner_id: "owner" };
    assert.equal(await keeps({ ...actor, role_code: "admin" }, record), true);
    assert.equal(await keeps(actor, record), false);
    assert.equal(await keeps(actor, { ...record, created_by: actor.id }), status === "pending_review");
    assert.equal(await keeps(actor, { ...record, owner_id: actor.id }), status === "pending_review");
  }
  assert.match(repository, /if \(explicitDeny\) return false;[\s\S]*!grantContext.restricted && \["discover", "metadata.view", "preview", "download", "edit"\]/);
});
