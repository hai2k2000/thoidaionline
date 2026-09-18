import assert from "node:assert/strict";
import test from "node:test";
import { parseArticleUrl, parseWithdrawalReason, transitionPublication, validateMetadataPatch } from "./journalismMutationPolicy.mjs";

test("publish requires credential-free absolute HTTP(S) URL", () => {
  assert.equal(parseArticleUrl("https://example.test/story").ok, true);
  assert.equal(parseArticleUrl("https://user:pass@example.test/story").ok, false);
  assert.equal(parseArticleUrl("javascript:alert(1)").ok, false);
});

test("scheduled metadata always keeps a planned publication time", () => {
  assert.equal(validateMetadataPatch("scheduled", { plannedPublicationAt: null }).ok, false);
  assert.equal(validateMetadataPatch("published", { plannedPublicationAt: "2026-09-18T00:00:00Z" }).ok, false);
});

test("publication state machine preserves planned time and requires withdrawal reason", () => {
  const published = transitionPublication({ status: "scheduled", plannedPublicationAt: "2026-09-18T00:00:00Z", publishedAt: null, articleUrl: null }, { status: "published", articleUrl: "https://example.test/a" });
  assert.equal(published.ok, true);
  assert.equal(published.value.plannedPublicationAt, "2026-09-18T00:00:00Z");
  assert.equal(transitionPublication(published.value, { status: "withdrawn", reason: "  " }).ok, false);
  assert.equal(parseWithdrawalReason("x".repeat(2001)).ok, false);
});
