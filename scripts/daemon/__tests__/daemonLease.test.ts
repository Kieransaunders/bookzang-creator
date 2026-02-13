import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldRecoverStaleLease,
  computeNextLeaseDelayMs,
} from "../leaseLogic";

test("stale lease is recoverable when expiry is in the past", () => {
  const now = 2_000;
  assert.equal(shouldRecoverStaleLease(1_999, now), true);
  assert.equal(shouldRecoverStaleLease(2_000, now), false);
});

test("lease polling delay increases with empty loops", () => {
  assert.equal(computeNextLeaseDelayMs(0), 2_000);
  assert.equal(computeNextLeaseDelayMs(3), 3_500);
  assert.equal(computeNextLeaseDelayMs(40), 10_000);
});
