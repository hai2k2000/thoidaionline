import assert from "node:assert/strict"; import test from "node:test"; import { buildExternalLinksPayload, isSafeExternalUrl, validateExternalLinkRows } from "./externalLinks.mjs";
import { readFileSync } from "node:fs";
import { selectableCategories, filterLanguageRecordTypes, resolveCategoryFilter, recordTypesForFilter } from "./languageGroup.mjs";

test("link rows ignore empty rows, preserve provider and order, and allow clearing", () => {
  assert.deepEqual(buildExternalLinksPayload([]), []);
  assert.deepEqual(buildExternalLinksPayload([{ label: "  ", url: "  " }]), []);
  assert.deepEqual(buildExternalLinksPayload([
    { provider: "google_drive", label: " Drive ", url: " https://drive.google.com/file/d/1 " },
    { label: " Web ", url: " https://example.test " },
  ]), [
    { provider: "google_drive", label: "Drive", url: "https://drive.google.com/file/d/1" },
    { provider: "web", label: "Web", url: "https://example.test" },
  ]);
});

test("link validation blocks incomplete rows, insecure URLs and more than thirty links", () => {
  for (const row of [{ label: "Title", url: "" }, { label: "", url: "https://example.test" }, { label: "Title", url: "http://example.test" }, { label: "Title", url: "https:example.test" }, { label: "Title", url: "javascript:alert(1)" }]) {
    assert.equal(validateExternalLinkRows([row]).length, 1);
    assert.match(validateExternalLinkRows([row])[0].message, /liên kết/);
  }
  assert.deepEqual(validateExternalLinkRows([{ label: " ", url: " " }]), []);
  const row = { label: "Title", url: "https://example.test/path" };
  assert.deepEqual(validateExternalLinkRows(Array(30).fill(row)), []);
  assert.equal(validateExternalLinkRows(Array(31).fill(row)).length, 1);
});

test("anchor URL policy allows HTTP only for metadata and never other schemes", () => {
  for (const value of ["javascript:alert(1)", "data:text/html,test", "ftp://example.test", "//example.test", "https:example.test", "https://", "https:\\example.test", "https://[", "https\n://example.test"]) {
    assert.equal(isSafeExternalUrl(value), false, value);
    assert.equal(isSafeExternalUrl(value, true), false, value);
  }
  assert.equal(isSafeExternalUrl("https://example.test"), true);
  assert.equal(isSafeExternalUrl("http://example.test"), false);
  assert.equal(isSafeExternalUrl("http://example.test", true), true);
});

test("form and detail link contracts preserve payload and secure anchors", () => {
  const form = readFileSync("src/components/DatabaseRecordForm.tsx", "utf8");
  const detail = readFileSync("src/app/database/records/[id]/page.tsx", "utf8");
  assert.match(form, /label: link.label \?\? link.url/);
  assert.match(form, /provider: link.provider/);
  assert.match(form, /externalLinks: buildExternalLinksPayload\(externalLinks\)/);
  assert.match(form, /externalLinks.length<30/);
  assert.match(form, /invalid_external_link: "Liên kết/);
  assert.match(form, /fieldError\("externalLinks"\)/);
  assert.match(detail, /visibility: detail.record.visibility/);
  assert.match(detail, /externalLinks: detail.externalLinks/);
  assert.match(detail, /detail.externalLinks.length \? <section/);
  assert.match(detail, /isSafeExternalUrl\(link.url\) \? <a href=\{link.url\} target="_blank" rel="noopener noreferrer"/);
  assert.match(detail, /\{link.label \|\| link.url\}<\/a>/);
  assert.match(detail, /data_type === "url" && typeof value === "string" && isSafeExternalUrl\(value, true\) \? <a href=\{value\} target="_blank" rel="noopener noreferrer"/);
  assert.match(detail, /!detail\?\.editKeepsStatus && \(detail\?\.record.status === "approved"/);
  assert.match(detail, /detail.canEdit \? <button/);
  assert.match(detail, /onSaved=\{async \(\) => \{ await load\(\); setEditing\(false\); \}\}/);
});

test("media category flows through generic creation and filter selectors", () => {
  const categories = [{ id: "media", code: "anh_video", name: "Ảnh, video", parent_id: null }];
  const types = [{ id: "photo", category_id: "media", name: "Ảnh" }];
  assert.deepEqual(selectableCategories(categories), categories);
  assert.deepEqual(filterLanguageRecordTypes(types, categories, "media"), types);
  assert.equal(resolveCategoryFilter(categories, "media").rootId, "media");
  assert.deepEqual(recordTypesForFilter(types, categories, "media"), types);
});
test("validates and builds external links",()=>{assert.equal(isSafeExternalUrl("https://example.com"),true);assert.equal(isSafeExternalUrl("javascript:alert(1)"),false);assert.equal(validateExternalLinkRows([{label:"",url:""}]).length,0);assert.equal(validateExternalLinkRows([{label:"x",url:"http://example.com"}]).length,1);assert.deepEqual(buildExternalLinksPayload([{provider:"google_drive",label:" Drive ",url:" https://drive.google.com/x "},{provider:"web",label:"",url:""}]),[{provider:"google_drive",label:"Drive",url:"https://drive.google.com/x"}]);});
