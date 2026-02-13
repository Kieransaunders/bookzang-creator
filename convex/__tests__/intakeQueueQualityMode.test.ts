import test from "node:test";
import assert from "node:assert/strict";
import { buildIngestJobPayload } from "../intake";

test("buildIngestJobPayload defaults to quality mode", () => {
  const payload = buildIngestJobPayload({
    bookId: "book-1",
    gutenbergId: "11",
    now: 1700000000000,
  });

  assert.ok(payload);
  assert.equal(payload?.mode, "quality");
  assert.equal(payload?.status, "queued");
  assert.equal(payload?.gutenbergId, "11");
  assert.equal(payload?.queuedAt, 1700000000000);
});

test("buildIngestJobPayload returns null without gutenbergId", () => {
  const payload = buildIngestJobPayload({
    bookId: "book-1",
    now: 1700000000000,
  });

  assert.equal(payload, null);
});
