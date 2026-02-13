import assert from "node:assert/strict";
import test from "node:test";

import {
  planOpenRouterModelOrder,
  shouldFallbackToNextModel,
} from "../openrouterRouting";

test("orders preferred model first and removes duplicates", () => {
  const result = planOpenRouterModelOrder({
    primaryModel: "openrouter/openai/gpt-4o-mini",
    fallbackModels: [
      "openrouter/anthropic/claude-3.5-sonnet",
      "openrouter/openai/gpt-4o-mini",
      "openrouter/google/gemini-2.0-flash-001",
      "openrouter/anthropic/claude-3.5-sonnet",
    ],
  });

  assert.deepEqual(result, [
    "openrouter/openai/gpt-4o-mini",
    "openrouter/anthropic/claude-3.5-sonnet",
    "openrouter/google/gemini-2.0-flash-001",
  ]);
});

test("drops empty model ids after trimming", () => {
  const result = planOpenRouterModelOrder({
    primaryModel: "  ",
    fallbackModels: [
      " ",
      "openrouter/anthropic/claude-3.5-sonnet  ",
      "\topenrouter/anthropic/claude-3.5-sonnet",
      "",
      "openrouter/google/gemini-2.0-flash-001",
    ],
  });

  assert.deepEqual(result, [
    "openrouter/anthropic/claude-3.5-sonnet",
    "openrouter/google/gemini-2.0-flash-001",
  ]);
});

test("falls back on retryable provider status codes", () => {
  const result = shouldFallbackToNextModel({
    statusCode: 429,
    attemptIndex: 0,
    totalModels: 3,
  });

  assert.equal(result, true);
});

test("does not fallback on non-retryable provider status codes", () => {
  const result = shouldFallbackToNextModel({
    statusCode: 400,
    attemptIndex: 0,
    totalModels: 3,
  });

  assert.equal(result, false);
});

test("does not fallback when the final model was already attempted", () => {
  const result = shouldFallbackToNextModel({
    statusCode: 503,
    attemptIndex: 2,
    totalModels: 3,
  });

  assert.equal(result, false);
});

test("does not fallback when attempt index is negative", () => {
  const result = shouldFallbackToNextModel({
    statusCode: 503,
    attemptIndex: -1,
    totalModels: 3,
  });

  assert.equal(result, false);
});

test("does not fallback when total models is zero", () => {
  const result = shouldFallbackToNextModel({
    statusCode: 503,
    attemptIndex: 0,
    totalModels: 0,
  });

  assert.equal(result, false);
});

test("uses expected retryable status boundaries", () => {
  assert.equal(
    shouldFallbackToNextModel({
      statusCode: 499,
      attemptIndex: 0,
      totalModels: 2,
    }),
    false,
  );
  assert.equal(
    shouldFallbackToNextModel({
      statusCode: 500,
      attemptIndex: 0,
      totalModels: 2,
    }),
    true,
  );
  assert.equal(
    shouldFallbackToNextModel({
      statusCode: 599,
      attemptIndex: 0,
      totalModels: 2,
    }),
    true,
  );
  assert.equal(
    shouldFallbackToNextModel({
      statusCode: 600,
      attemptIndex: 0,
      totalModels: 2,
    }),
    false,
  );
});

test("does not fallback on invalid status values", () => {
  assert.equal(
    shouldFallbackToNextModel({
      statusCode: Number.NaN,
      attemptIndex: 0,
      totalModels: 2,
    }),
    false,
  );
  assert.equal(
    shouldFallbackToNextModel({
      statusCode: 0,
      attemptIndex: 0,
      totalModels: 2,
    }),
    false,
  );
});
