import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTaskLink } from "./taskLinkPolicy.mjs";

test("normalizes any HTTPS host and defaults the display title", () => {
  assert.deepEqual(normalizeTaskLink("  https://docs.google.com/document/d/abc  "), { url: "https://docs.google.com/document/d/abc", title: "docs.google.com" });
  assert.deepEqual(normalizeTaskLink("https://example.org/a", "  My document  "), { url: "https://example.org/a", title: "My document" });
  assert.equal(normalizeTaskLink("https://private.example:8443/path", " ").title, "private.example");
  assert.equal(normalizeTaskLink("https://example.org", "x".repeat(201)).title.length, 200);
});

test("rejects unsafe or malformed links without silently repairing them", () => {
  for (const url of ["http://example.org", "javascript:alert(1)", "data:text/plain,test", "https://user@example.org", "https://user:pass@example.org", "https://@example.org", "https:///example.org", "https://", "https://example.org/a b", "https://example.org/\npath", "https://example.org\\@evil.org", `https://example.org/${"a".repeat(2048)}`, null, 12]) {
    assert.equal(normalizeTaskLink(url), null, String(url));
  }
  assert.equal(normalizeTaskLink("https://example.org", {}), null);
});

test("does not whitelist hostnames and respects the exact URL length boundary", () => {
  for (const url of ["https://foo_bar/path", "https://münich.example/path", "https://127.0.0.1:8443/path", "https://[::1]/path"]) assert.ok(normalizeTaskLink(url), url);
  const url = "https://example.org/" + "a".repeat(2048 - "https://example.org/".length);
  assert.equal(normalizeTaskLink(url).url.length, 2048);
  assert.equal(normalizeTaskLink(url + "a"), null);
});
