import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeTelemetryInsert,
  type CleanupTelemetryInput,
} from "../cleanupTelemetry";

test("normalizes telemetry with all fields present", () => {
  const input: CleanupTelemetryInput = {
    requestedModel: "openrouter/anthropic/claude-3.5-sonnet",
    resolvedModel: "openrouter/anthropic/claude-3.5-sonnet",
    fallbackUsed: false,
    chunkCount: 3,
    maxChunkChars: 12000,
    overlapChars: 800,
    totalInputChars: 35000,
    processingStartedAt: 1700000000000,
    processingCompletedAt: 1700000100000,
  };

  const result = normalizeTelemetryInsert(input);

  assert.equal(result.requestedModel, "openrouter/anthropic/claude-3.5-sonnet");
  assert.equal(result.resolvedModel, "openrouter/anthropic/claude-3.5-sonnet");
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.chunkCount, 3);
  assert.equal(result.maxChunkChars, 12000);
  assert.equal(result.overlapChars, 800);
  assert.equal(result.totalInputChars, 35000);
  assert.equal(result.processingStartedAt, 1700000000000);
  assert.equal(result.processingCompletedAt, 1700000100000);
});

test("normalizes telemetry with missing optional fields", () => {
  const input: CleanupTelemetryInput = {
    requestedModel: "openrouter/anthropic/claude-3.5-sonnet",
    resolvedModel: "openrouter/anthropic/claude-3.5-sonnet",
  };

  const result = normalizeTelemetryInsert(input);

  assert.equal(result.requestedModel, "openrouter/anthropic/claude-3.5-sonnet");
  assert.equal(result.resolvedModel, "openrouter/anthropic/claude-3.5-sonnet");
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.chunkCount, 0);
  assert.equal(result.maxChunkChars, 0);
  assert.equal(result.overlapChars, 0);
  assert.equal(result.totalInputChars, 0);
  assert.equal(result.processingStartedAt, undefined);
  assert.equal(result.processingCompletedAt, undefined);
});

test("clamps negative numeric values to 0", () => {
  const input: CleanupTelemetryInput = {
    requestedModel: "test-model",
    resolvedModel: "test-model",
    chunkCount: -5,
    maxChunkChars: -1000,
    totalInputChars: -10000,
  };

  const result = normalizeTelemetryInsert(input);

  assert.equal(result.chunkCount, 0);
  assert.equal(result.maxChunkChars, 0);
  assert.equal(result.totalInputChars, 0);
});

test("normalizes non-finite numeric values to 0", () => {
  const input: CleanupTelemetryInput = {
    requestedModel: "test-model",
    resolvedModel: "test-model",
    chunkCount: Number.NaN,
    maxChunkChars: Number.POSITIVE_INFINITY,
    totalInputChars: Number.NEGATIVE_INFINITY,
  };

  const result = normalizeTelemetryInsert(input);

  assert.equal(result.chunkCount, 0);
  assert.equal(result.maxChunkChars, 0);
  assert.equal(result.totalInputChars, 0);
});

test("trims model names and defaults empty to unknown", () => {
  const input: CleanupTelemetryInput = {
    requestedModel: "  openrouter/model  ",
    resolvedModel: "   ",
  };

  const result = normalizeTelemetryInsert(input);

  assert.equal(result.requestedModel, "openrouter/model");
  assert.equal(result.resolvedModel, "unknown");
});

test("coerces fallbackUsed to boolean", () => {
  const withTrue = normalizeTelemetryInsert({
    requestedModel: "model",
    resolvedModel: "model",
    fallbackUsed: true,
  });

  const withFalse = normalizeTelemetryInsert({
    requestedModel: "model",
    resolvedModel: "model",
    fallbackUsed: false,
  });

  const withUndefined = normalizeTelemetryInsert({
    requestedModel: "model",
    resolvedModel: "model",
  });

  assert.equal(withTrue.fallbackUsed, true);
  assert.equal(withFalse.fallbackUsed, false);
  assert.equal(withUndefined.fallbackUsed, false);
});

test("preserves timestamp fields when provided", () => {
  const input: CleanupTelemetryInput = {
    requestedModel: "model",
    resolvedModel: "model",
    processingStartedAt: 1700000000000,
    processingCompletedAt: 1700000050000,
  };

  const result = normalizeTelemetryInsert(input);

  assert.equal(result.processingStartedAt, 1700000000000);
  assert.equal(result.processingCompletedAt, 1700000050000);
});

test("rejects telemetry with missing required model fields", () => {
  assert.throws(() => {
    normalizeTelemetryInsert({
      requestedModel: "",
      resolvedModel: "",
    } as CleanupTelemetryInput);
  }, /model/i);
});
