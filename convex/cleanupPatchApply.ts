/**
 * Cleanup Patch Application Logic
 * 
 * Validates and applies AI-generated patches to produce new cleaned revisions.
 * Enforces immutable originals and revision incrementing.
 * 
 * Key principles:
 * - Original text never changes (stored in cleanupOriginals)
 * - Each AI pass creates a new revision with incremented revision number
 * - Patches are validated before application
 * - Low-confidence patches create unresolved flags
 */

import { v } from "convex/values";
import { internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { CleanupPatch } from "./cleanupPrompts";
import { calculatePatchStats } from "./cleanupPrompts";

/**
 * Internal mutation to apply validated patches and create a new revision
 * 
 * This is the core "safe apply" function that:
 * 1. Gets the parent revision's content
 * 2. Applies patches in reverse order (to preserve offsets)
 * 3. Creates a new revision with incremented number
 * 4. Creates low-confidence flags for reviewer attention
 */
export const applyPatchesAndCreateRevision = internalMutation({
  args: {
    bookId: v.id("books"),
    parentRevisionId: v.id("cleanupRevisions"),
    patches: v.array(v.object({
      start: v.number(),
      end: v.number(),
      original: v.string(),
      replacement: v.string(),
      confidence: v.union(v.literal("high"), v.literal("low")),
      reason: v.string(),
      category: v.union(
        v.literal("ocr_error"),
        v.literal("punctuation_normalization"),
        v.literal("typo_correction"),
        v.literal("hyphenation_fix"),
        v.literal("formatting"),
      ),
    })),
    summary: v.string(),
    preservationNotes: v.array(v.string()),
  },
  returns: v.object({
    newRevisionId: v.id("cleanupRevisions"),
    flagsCreated: v.number(),
    patchesApplied: v.number(),
  }),
  handler: async (ctx, args) => {
    // Get the parent revision
    const parentRevision = await ctx.db.get(args.parentRevisionId);
    if (!parentRevision) {
      throw new Error(`Parent revision ${args.parentRevisionId} not found`);
    }

    // Apply patches to create new content
    const { newContent, appliedPatches, failedPatches } = applyPatchesSafely(
      parentRevision.content,
      args.patches
    );

    // Calculate new revision number
    const newRevisionNumber = parentRevision.revisionNumber + 1;

    // Create the new revision
    const newRevisionId = await ctx.db.insert("cleanupRevisions", {
      bookId: args.bookId,
      revisionNumber: newRevisionNumber,
      content: newContent,
      isDeterministic: false, // AI-assisted revision
      isAiAssisted: true,
      preserveArchaic: parentRevision.preserveArchaic,
      createdAt: Date.now(),
      createdBy: "ai",
      parentRevisionId: args.parentRevisionId,
    });

    // Create flags for low-confidence patches
    let flagsCreated = 0;
    for (const patch of appliedPatches) {
      if (patch.confidence === "low") {
        await ctx.db.insert("cleanupFlags", {
          bookId: args.bookId,
          revisionId: newRevisionId,
          type: "low_confidence_cleanup",
          status: "unresolved",
          startOffset: patch.start,
          endOffset: patch.end,
          contextText: `AI suggestion: "${patch.original.slice(0, 50)}..." → "${patch.replacement.slice(0, 50)}..."`,
          suggestedAction: `${patch.reason} (${patch.category})`,
          createdAt: Date.now(),
        });
        flagsCreated++;
      }
    }

    // Create flags for failed patches (application errors)
    for (const patch of failedPatches) {
      await ctx.db.insert("cleanupFlags", {
        bookId: args.bookId,
        revisionId: newRevisionId,
        type: "low_confidence_cleanup",
        status: "unresolved",
        startOffset: patch.patch.start,
        endOffset: patch.patch.end,
        contextText: `Failed AI patch: ${patch.error}`,
        suggestedAction: "Review patch that failed to apply",
        createdAt: Date.now(),
      });
      flagsCreated++;
    }

    // Create chapter records by copying and adjusting from parent
    await ctx.runMutation(internal.cleanupPatchApply.copyChaptersForNewRevision, {
      bookId: args.bookId,
      parentRevisionId: args.parentRevisionId,
      newRevisionId,
    });

    return {
      newRevisionId,
      flagsCreated,
      patchesApplied: appliedPatches.length,
    };
  },
});

/**
 * Apply patches safely to text
 * 
 * Algorithm:
 * 1. Sort patches by start position (descending) to preserve offsets
 * 2. Apply each patch, verifying original text matches
 * 3. Track which patches succeeded/failed
 */
function applyPatchesSafely(
  originalText: string,
  patches: CleanupPatch[]
): {
  newContent: string;
  appliedPatches: CleanupPatch[];
  failedPatches: { patch: CleanupPatch; error: string }[];
} {
  // Sort patches by start position descending (apply from end to start)
  // This way, earlier patches' offsets aren't affected by later patches
  const sortedPatches = [...patches].sort((a, b) => b.start - a.start);

  let currentText = originalText;
  const appliedPatches: CleanupPatch[] = [];
  const failedPatches: { patch: CleanupPatch; error: string }[] = [];

  for (const patch of sortedPatches) {
    // Validate patch is within bounds
    if (patch.start < 0 || patch.end > currentText.length) {
      failedPatches.push({
        patch,
        error: `Offsets out of bounds: ${patch.start}-${patch.end} (text length: ${currentText.length})`,
      });
      continue;
    }

    // Verify original text matches
    const actualOriginal = currentText.slice(patch.start, patch.end);
    if (actualOriginal !== patch.original) {
      failedPatches.push({
        patch,
        error: `Original text mismatch: expected "${patch.original.slice(0, 30)}...", found "${actualOriginal.slice(0, 30)}..."`,
      });
      continue;
    }

    // Apply the patch
    currentText =
      currentText.slice(0, patch.start) +
      patch.replacement +
      currentText.slice(patch.end);

    appliedPatches.push(patch);
  }

  return { newContent: currentText, appliedPatches, failedPatches };
}

/**
 * Copy chapter records from parent revision to new revision
 * Updates content slices to match new text
 */
export const copyChaptersForNewRevision: ReturnType<typeof internalMutation> = internalMutation({
  args: {
    bookId: v.id("books"),
    parentRevisionId: v.id("cleanupRevisions"),
    newRevisionId: v.id("cleanupRevisions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get parent chapters
    const parentChapters = await ctx.db
      .query("cleanupChapters")
      .withIndex("by_revision_id", q => q.eq("revisionId", args.parentRevisionId))
      .order("asc")
      .collect();

    // Get new revision content
    const newRevision = await ctx.db.get(args.newRevisionId);
    if (!newRevision) {
      throw new Error("New revision not found");
    }

    // Copy chapters with updated content
    for (const chapter of parentChapters) {
      // For now, copy chapters as-is
      // In a more sophisticated implementation, we would:
      // 1. Map offsets from old text to new text
      // 2. Extract updated content slices
      // 3. Handle chapter boundary shifts from edits

      await ctx.db.insert("cleanupChapters", {
        bookId: args.bookId,
        revisionId: args.newRevisionId,
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        type: chapter.type,
        content: chapter.content, // Will need offset mapping for precision
        startOffset: chapter.startOffset,
        endOffset: chapter.endOffset,
        detectedHeading: chapter.detectedHeading,
        isUserConfirmed: chapter.isUserConfirmed,
        createdAt: Date.now(),
      });
    }

    return null;
  },
});

/**
 * Create a new revision from manual edits (user-initiated)
 * Similar to AI revision but marked as user-created
 */
export const createManualRevision: ReturnType<typeof internalMutation> = internalMutation({
  args: {
    bookId: v.id("books"),
    parentRevisionId: v.id("cleanupRevisions"),
    newContent: v.string(),
    editedBy: v.id("users"),
    editSummary: v.optional(v.string()),
  },
  returns: v.object({
    newRevisionId: v.id("cleanupRevisions"),
  }),
  handler: async (ctx, args) => {
    const parentRevision = await ctx.db.get(args.parentRevisionId);
    if (!parentRevision) {
      throw new Error(`Parent revision ${args.parentRevisionId} not found`);
    }

    const newRevisionNumber = parentRevision.revisionNumber + 1;

    const newRevisionId = await ctx.db.insert("cleanupRevisions", {
      bookId: args.bookId,
      revisionNumber: newRevisionNumber,
      content: args.newContent,
      isDeterministic: false,
      isAiAssisted: false,
      preserveArchaic: parentRevision.preserveArchaic,
      createdAt: Date.now(),
      createdBy: "user",
      parentRevisionId: args.parentRevisionId,
    });

    // Copy chapters
    await ctx.runMutation(internal.cleanupPatchApply.copyChaptersForNewRevision, {
      bookId: args.bookId,
      parentRevisionId: args.parentRevisionId,
      newRevisionId,
    });

    return { newRevisionId };
  },
});

/**
 * Get diff between two revisions
 * Returns line-level diff for review display
 */
export const getRevisionDiff = internalAction({
  args: {
    revisionId1: v.id("cleanupRevisions"),
    revisionId2: v.id("cleanupRevisions"),
  },
  returns: v.object({
    additions: v.number(),
    deletions: v.number(),
    changes: v.array(v.object({
      type: v.union(v.literal("added"), v.literal("removed"), v.literal("unchanged")),
      content: v.string(),
    })),
  }),
  handler: async (ctx, args) => {
    // This would use the 'diff' library in a real implementation
    // For now, return placeholder
    return {
      additions: 0,
      deletions: 0,
      changes: [],
    };
  },
});

/**
 * Rollback to a previous revision
 * Creates a new revision with the content from the target revision
 */
export const rollbackToRevision: ReturnType<typeof internalMutation> = internalMutation({
  args: {
    bookId: v.id("books"),
    targetRevisionId: v.id("cleanupRevisions"),
    reason: v.string(),
    userId: v.id("users"),
  },
  returns: v.object({
    newRevisionId: v.id("cleanupRevisions"),
  }),
  handler: async (ctx, args) => {
    // Get current latest revision
    const latestRevisions = await ctx.db
      .query("cleanupRevisions")
      .withIndex("by_book_id_revision", q => q.eq("bookId", args.bookId))
      .order("desc")
      .take(1);

    const currentRevision = latestRevisions[0];
    if (!currentRevision) {
      throw new Error("No current revision found");
    }

    // Get target revision
    const targetRevision = await ctx.db.get(args.targetRevisionId);
    if (!targetRevision) {
      throw new Error(`Target revision ${args.targetRevisionId} not found`);
    }

    // Create new revision with target content
    const newRevisionId = await ctx.db.insert("cleanupRevisions", {
      bookId: args.bookId,
      revisionNumber: currentRevision.revisionNumber + 1,
      content: targetRevision.content,
      isDeterministic: false,
      isAiAssisted: false,
      preserveArchaic: targetRevision.preserveArchaic,
      createdAt: Date.now(),
      createdBy: "user",
      parentRevisionId: currentRevision._id,
    });

    // Copy chapters from target revision
    const targetChapters = await ctx.db
      .query("cleanupChapters")
      .withIndex("by_revision_id", q => q.eq("revisionId", args.targetRevisionId))
      .order("asc")
      .collect();

    for (const chapter of targetChapters) {
      await ctx.db.insert("cleanupChapters", {
        bookId: args.bookId,
        revisionId: newRevisionId,
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        type: chapter.type,
        content: chapter.content,
        startOffset: chapter.startOffset,
        endOffset: chapter.endOffset,
        detectedHeading: chapter.detectedHeading,
        isUserConfirmed: chapter.isUserConfirmed,
        createdAt: Date.now(),
      });
    }

    return { newRevisionId };
  },
});

/**
 * Validate patch can be applied to text
 * Used before attempting application
 */
export function validatePatch(
  text: string,
  patch: CleanupPatch
): { valid: true } | { valid: false; reason: string } {
  // Check bounds
  if (patch.start < 0 || patch.end > text.length) {
    return {
      valid: false,
      reason: `Offsets ${patch.start}-${patch.end} out of bounds for text length ${text.length}`,
    };
  }

  // Check start <= end
  if (patch.start > patch.end) {
    return {
      valid: false,
      reason: `Invalid range: start (${patch.start}) > end (${patch.end})`,
    };
  }

  // Verify original matches
  const actualOriginal = text.slice(patch.start, patch.end);
  if (actualOriginal !== patch.original) {
    return {
      valid: false,
      reason: `Original text mismatch at ${patch.start}-${patch.end}: expected "${patch.original.slice(0, 30)}...", found "${actualOriginal.slice(0, 30)}..."`,
    };
  }

  return { valid: true };
}

/**
 * Batch validate multiple patches
 */
export function validatePatchBatch(
  text: string,
  patches: CleanupPatch[]
): {
  valid: CleanupPatch[];
  invalid: { patch: CleanupPatch; reason: string }[];
} {
  const valid: CleanupPatch[] = [];
  const invalid: { patch: CleanupPatch; reason: string }[] = [];

  for (const patch of patches) {
    const result = validatePatch(text, patch);
    if (result.valid) {
      valid.push(patch);
    } else {
      invalid.push({ patch, reason: result.reason });
    }
  }

  return { valid, invalid };
}
