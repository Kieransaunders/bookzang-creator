import { v, type GenericId as Id } from "convex/values";
import { internalMutation } from "./_generated/server";
import {
  DEFAULT_AMBIGUITY_THRESHOLDS,
  type AmbiguityKind,
} from "./cleanupDecisionPolicy";

export type CleanupAutoResolutionFlagType = AmbiguityKind;

const cleanupAutoResolutionFlagTypeValidator = v.union(
  v.literal("unlabeled_boundary_candidate"),
  v.literal("low_confidence_cleanup"),
  v.literal("ocr_corruption_detected"),
  v.literal("ambiguous_punctuation"),
  v.literal("chapter_boundary_disputed"),
);

type CleanupAutoResolutionInsertInput = {
  bookId: Id<"books">;
  revisionId: Id<"cleanupRevisions">;
  flagType: CleanupAutoResolutionFlagType;
  startOffset: number;
  endOffset: number;
  beforeText: string;
  afterText: string;
  confidence: number;
  thresholdUsed: number;
  rationale: string;
  createdAt: number;
};

function clampUnitInterval(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeUnitInterval(value: number, fallback: number): number {
  if (Number.isNaN(value)) {
    return clampUnitInterval(fallback);
  }
  if (value === Number.POSITIVE_INFINITY) {
    return 1;
  }
  if (value === Number.NEGATIVE_INFINITY) {
    return 0;
  }
  return clampUnitInterval(value);
}

export function buildCleanupAutoResolutionInsert(
  input: CleanupAutoResolutionInsertInput,
): CleanupAutoResolutionInsertInput {
  const thresholdFallback = DEFAULT_AMBIGUITY_THRESHOLDS[input.flagType];

  return {
    ...input,
    confidence: normalizeUnitInterval(input.confidence, 0),
    thresholdUsed: normalizeUnitInterval(
      input.thresholdUsed,
      thresholdFallback,
    ),
  };
}

export const recordAutoResolutions = internalMutation({
  args: {
    resolutions: v.array(
      v.object({
        bookId: v.id("books"),
        revisionId: v.id("cleanupRevisions"),
        flagType: cleanupAutoResolutionFlagTypeValidator,
        startOffset: v.number(),
        endOffset: v.number(),
        beforeText: v.string(),
        afterText: v.string(),
        confidence: v.number(),
        thresholdUsed: v.number(),
        rationale: v.string(),
        createdAt: v.optional(v.number()),
      }),
    ),
  },
  returns: v.array(v.id("cleanupAutoResolutions")),
  handler: async (ctx, args) => {
    const insertedIds: Id<"cleanupAutoResolutions">[] = [];
    const now = Date.now();

    for (const resolution of args.resolutions) {
      const payload = buildCleanupAutoResolutionInsert({
        ...resolution,
        createdAt: resolution.createdAt ?? now,
      });
      const id = await ctx.db.insert("cleanupAutoResolutions", payload);
      insertedIds.push(id);
    }

    return insertedIds;
  },
});
