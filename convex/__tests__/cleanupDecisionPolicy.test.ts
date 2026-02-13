import assert from "node:assert/strict";
import test from "node:test";

import { decideAmbiguityAction } from "../cleanupDecisionPolicy";
import { deriveEffectivePatchConfidenceScore } from "../cleanupPrompts";
import { buildCleanupAutoResolutionInsert } from "../cleanupAutoResolutions";

test("auto-applies above configured per-type threshold", () => {
  const result = decideAmbiguityAction({
    type: "ambiguous_punctuation",
    confidence: 0.86,
    thresholds: { ambiguous_punctuation: 0.8 },
  });

  assert.equal(result.action, "auto_apply");
  assert.equal(result.thresholdUsed, 0.8);
  assert.equal(result.clampedConfidence, 0.86);
});

test("manual-review below configured threshold", () => {
  const result = decideAmbiguityAction({
    type: "ocr_corruption_detected",
    confidence: 0.89,
    thresholds: { ocr_corruption_detected: 0.9 },
  });

  assert.equal(result.action, "manual_review");
  assert.equal(result.thresholdUsed, 0.9);
  assert.equal(result.clampedConfidence, 0.89);
});

test("falls back to default threshold when type missing", () => {
  const result = decideAmbiguityAction({
    type: "chapter_boundary_disputed",
    confidence: 0.97,
    thresholds: { ambiguous_punctuation: 0.5 },
  });

  assert.equal(result.action, "manual_review");
  assert.equal(result.thresholdUsed, 0.98);
  assert.equal(result.clampedConfidence, 0.97);
});

test("exact threshold is auto-apply", () => {
  const result = decideAmbiguityAction({
    type: "low_confidence_cleanup",
    confidence: 0.92,
    thresholds: {},
  });

  assert.equal(result.action, "auto_apply");
  assert.equal(result.thresholdUsed, 0.92);
  assert.equal(result.clampedConfidence, 0.92);
});

test("confidence is clamped into [0, 1]", () => {
  const low = decideAmbiguityAction({
    type: "unlabeled_boundary_candidate",
    confidence: -0.25,
    thresholds: { unlabeled_boundary_candidate: 0.1 },
  });

  const high = decideAmbiguityAction({
    type: "unlabeled_boundary_candidate",
    confidence: 1.25,
    thresholds: { unlabeled_boundary_candidate: 0.99 },
  });

  assert.equal(low.clampedConfidence, 0);
  assert.equal(high.clampedConfidence, 1);
});

test("NaN confidence normalizes to 0 and requires manual review", () => {
  const result = decideAmbiguityAction({
    type: "ambiguous_punctuation",
    confidence: Number.NaN,
  });

  assert.equal(result.clampedConfidence, 0);
  assert.equal(result.action, "manual_review");
});

test("threshold override below 0 clamps to 0", () => {
  const result = decideAmbiguityAction({
    type: "ocr_corruption_detected",
    confidence: 0.1,
    thresholds: { ocr_corruption_detected: -0.5 },
  });

  assert.equal(result.thresholdUsed, 0);
  assert.equal(result.action, "auto_apply");
});

test("threshold override above 1 clamps to 1", () => {
  const result = decideAmbiguityAction({
    type: "low_confidence_cleanup",
    confidence: 0.99,
    thresholds: { low_confidence_cleanup: 1.5 },
  });

  assert.equal(result.thresholdUsed, 1);
  assert.equal(result.action, "manual_review");
});

test("infinite confidence values clamp to [0, 1] bounds", () => {
  const low = decideAmbiguityAction({
    type: "ambiguous_punctuation",
    confidence: Number.NEGATIVE_INFINITY,
  });

  const high = decideAmbiguityAction({
    type: "ambiguous_punctuation",
    confidence: Number.POSITIVE_INFINITY,
  });

  assert.equal(low.clampedConfidence, 0);
  assert.equal(high.clampedConfidence, 1);
});

test("non-finite threshold override values are normalized", () => {
  const nanThreshold = decideAmbiguityAction({
    type: "chapter_boundary_disputed",
    confidence: 0.99,
    thresholds: { chapter_boundary_disputed: Number.NaN },
  });

  const posInfThreshold = decideAmbiguityAction({
    type: "ambiguous_punctuation",
    confidence: 0.9,
    thresholds: { ambiguous_punctuation: Number.POSITIVE_INFINITY },
  });

  const negInfThreshold = decideAmbiguityAction({
    type: "ambiguous_punctuation",
    confidence: 0.1,
    thresholds: { ambiguous_punctuation: Number.NEGATIVE_INFINITY },
  });

  assert.equal(nanThreshold.thresholdUsed, 0.98);
  assert.equal(posInfThreshold.thresholdUsed, 1);
  assert.equal(negInfThreshold.thresholdUsed, 0);
});

test("patch confidence label maps to numeric defaults", () => {
  const high = deriveEffectivePatchConfidenceScore({
    confidence: "high",
  });
  const low = deriveEffectivePatchConfidenceScore({
    confidence: "low",
  });

  assert.equal(high, 0.9);
  assert.equal(low, 0.55);
});

test("patch confidenceScore overrides label mapping", () => {
  const score = deriveEffectivePatchConfidenceScore({
    confidence: "low",
    confidenceScore: 0.81,
  });

  assert.equal(score, 0.81);
});

test("patch non-finite confidenceScore values normalize safely", () => {
  const nan = deriveEffectivePatchConfidenceScore({
    confidence: "high",
    confidenceScore: Number.NaN,
  });
  const posInf = deriveEffectivePatchConfidenceScore({
    confidence: "low",
    confidenceScore: Number.POSITIVE_INFINITY,
  });
  const negInf = deriveEffectivePatchConfidenceScore({
    confidence: "high",
    confidenceScore: Number.NEGATIVE_INFINITY,
  });

  assert.equal(nan, 0.9);
  assert.equal(posInf, 1);
  assert.equal(negInf, 0);
});

test("auto-resolution payload helper normalizes confidence fields", () => {
  const payload = buildCleanupAutoResolutionInsert({
    bookId: "book-id" as never,
    revisionId: "revision-id" as never,
    flagType: "low_confidence_cleanup",
    startOffset: 10,
    endOffset: 20,
    beforeText: "bef0re",
    afterText: "before",
    confidence: 1.8,
    thresholdUsed: -0.2,
    rationale: "clear OCR swap",
    createdAt: 123,
  });

  assert.equal(payload.confidence, 1);
  assert.equal(payload.thresholdUsed, 0);
  assert.equal(payload.createdAt, 123);
});

test("auto-resolution payload helper uses per-type threshold fallback for NaN", () => {
  const ambiguousPunctuationPayload = buildCleanupAutoResolutionInsert({
    bookId: "book-id" as never,
    revisionId: "revision-id" as never,
    flagType: "ambiguous_punctuation",
    startOffset: 0,
    endOffset: 5,
    beforeText: "word",
    afterText: "word",
    confidence: Number.NaN,
    thresholdUsed: Number.NaN,
    rationale: "default safety fallback",
    createdAt: 456,
  });

  const lowConfidencePayload = buildCleanupAutoResolutionInsert({
    bookId: "book-id" as never,
    revisionId: "revision-id" as never,
    flagType: "low_confidence_cleanup",
    startOffset: 0,
    endOffset: 5,
    beforeText: "word",
    afterText: "word",
    confidence: Number.NaN,
    thresholdUsed: Number.NaN,
    rationale: "default safety fallback",
    createdAt: 789,
  });

  assert.equal(ambiguousPunctuationPayload.confidence, 0);
  assert.equal(ambiguousPunctuationPayload.thresholdUsed, 0.8);
  assert.equal(lowConfidencePayload.thresholdUsed, 0.92);
});
