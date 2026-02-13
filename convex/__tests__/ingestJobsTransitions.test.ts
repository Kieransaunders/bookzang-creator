import test from "node:test";
import assert from "node:assert/strict";
import { canTransitionIngestStatus } from "../ingestJobs";

test("lease transition queued -> leased -> completed is valid", () => {
  assert.equal(canTransitionIngestStatus("queued", "leased"), true);
  assert.equal(canTransitionIngestStatus("leased", "completed"), true);
  assert.equal(canTransitionIngestStatus("queued", "completed"), false);
});
