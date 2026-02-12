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

import { v, type GenericId as Id } from "convex/values";
import { internalMutation, internalAction, internalQuery } from "./_generated/server";
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
export const applyPatchesAndCreateRevision = internalAction({
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
  handler: async (ctx, args): Promise<{ newRevisionId: Id<"cleanupRevisions">; flagsCreated: number; patchesApplied: number }> => {
    // Get the parent revision metadata
    const parentRevision = await ctx.runQuery(internal.cleanupPatchApply.getRevisionMetadata, {
      revisionId: args.parentRevisionId,
    });
    if (!parentRevision) {
      throw new Error(`Parent revision ${args.parentRevisionId} not found`);
    }

    // Read parent content from file storage (not in database due to 1MB limit)
    if (!parentRevision.fileId) {
      throw new Error(`Parent revision ${args.parentRevisionId} has no fileId (legacy data)`);
    }
    const contentBlob = await ctx.storage.get(parentRevision.fileId);
    if (!contentBlob) {
      throw new Error(`Content file ${parentRevision.fileId} not found for revision ${args.parentRevisionId}`);
    }
    const parentContent = await contentBlob.text();

    // Apply patches to create new content
    const { newContent, appliedPatches, failedPatches } = applyPatchesSafely(
      parentContent,
      args.patches
    );

    // Calculate new revision number
    const newRevisionNumber = parentRevision.revisionNumber + 1;

    // Store new content as file
    const newContentBlob = new Blob([newContent], { type: "text/plain" });
    const newFileId = await ctx.storage.store(newContentBlob);

    // Create the new revision with file reference
    const newRevisionId: Id<"cleanupRevisions"> = await ctx.runMutation(internal.cleanupPatchApply.createRevisionRecord, {
      bookId: args.bookId,
      revisionNumber: newRevisionNumber,
      fileId: newFileId,
      sizeBytes: newContentBlob.size,
      isDeterministic: false,
      isAiAssisted: true,
      preserveArchaic: parentRevision.preserveArchaic,
      parentRevisionId: args.parentRevisionId,
    });

    // Create flags for low-confidence patches
    const lowConfidenceFlags = appliedPatches
      .filter(p => p.confidence === "low")
      .map(p => ({
        bookId: args.bookId,
        revisionId: newRevisionId,
        type: "low_confidence_cleanup" as const,
        status: "unresolved" as const,
        startOffset: p.start,
        endOffset: p.end,
        contextText: `AI suggestion: "${p.original.slice(0, 50)}..." → "${p.replacement.slice(0, 50)}..."`,
        suggestedAction: `${p.reason} (${p.category})`,
      }));

    // Create flags for failed patches (application errors)
    const failedPatchFlags = failedPatches.map(p => ({
      bookId: args.bookId,
      revisionId: newRevisionId,
      type: "low_confidence_cleanup" as const,
      status: "unresolved" as const,
      startOffset: p.patch.start,
      endOffset: p.patch.end,
      contextText: `Failed AI patch: ${p.error}`,
      suggestedAction: "Review patch that failed to apply",
    }));

    const flagsCreated = await ctx.runMutation(internal.cleanupPatchApply.createFlagsBatch, {
      flags: [...lowConfidenceFlags, ...failedPatchFlags],
    });

    // Create chapter records by copying and adjusting from parent
    await ctx.runAction(internal.cleanupPatchApply.copyChaptersForNewRevision, {
      bookId: args.bookId,
      parentRevisionId: args.parentRevisionId,
      newRevisionId,
      newRevisionFileId: newFileId,
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
 * Stores chapter content in file storage (not database - 1MB limit)
 */
export const copyChaptersForNewRevision = internalAction({
  args: {
    bookId: v.id("books"),
    parentRevisionId: v.id("cleanupRevisions"),
    newRevisionId: v.id("cleanupRevisions"),
    newRevisionFileId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    // Get parent chapters
    const parentChapters = await ctx.runQuery(internal.cleanupPatchApply.getChaptersForCopy, {
      revisionId: args.parentRevisionId,
    });

    // Read new revision content
    const newContentBlob = await ctx.storage.get(args.newRevisionFileId);
    if (!newContentBlob) {
      throw new Error("New revision content not found");
    }
    const newContent = await newContentBlob.text();

    // Copy chapters with content from new revision
    const chaptersForDb = [];
    for (const chapter of parentChapters) {
      // Extract chapter content from new revision text
      const chapterContent = newContent.slice(chapter.startOffset, chapter.endOffset);
      const chapterBlob = new Blob([chapterContent], { type: "text/plain" });
      const chapterFileId = await ctx.storage.store(chapterBlob);

      chaptersForDb.push({
        bookId: args.bookId,
        revisionId: args.newRevisionId,
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        type: chapter.type,
        fileId: chapterFileId,
        startOffset: chapter.startOffset,
        endOffset: chapter.endOffset,
        detectedHeading: chapter.detectedHeading,
        isUserConfirmed: chapter.isUserConfirmed,
        sizeBytes: chapterBlob.size,
      });
    }

    await ctx.runMutation(internal.cleanupPatchApply.createChaptersBatch, {
      chapters: chaptersForDb,
    });

    return null;
  },
});

/**
 * Create a new revision from manual edits (user-initiated)
 * Similar to AI revision but marked as user-created
 * Stores content in file storage (not database - 1MB limit)
 */
export const createManualRevision = internalAction({
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
  handler: async (ctx, args): Promise<{ newRevisionId: Id<"cleanupRevisions"> }> => {
    const parentRevision = await ctx.runQuery(internal.cleanupPatchApply.getRevisionMetadata, {
      revisionId: args.parentRevisionId,
    });
    if (!parentRevision) {
      throw new Error(`Parent revision ${args.parentRevisionId} not found`);
    }

    const newRevisionNumber = parentRevision.revisionNumber + 1;

    // Store new content as file
    const contentBlob = new Blob([args.newContent], { type: "text/plain" });
    const fileId = await ctx.storage.store(contentBlob);

    // Create revision with file reference
    const newRevisionId = await ctx.runMutation(internal.cleanupPatchApply.createRevisionRecord, {
      bookId: args.bookId,
      revisionNumber: newRevisionNumber,
      fileId,
      sizeBytes: contentBlob.size,
      isDeterministic: false,
      isAiAssisted: false,
      preserveArchaic: parentRevision.preserveArchaic,
      parentRevisionId: args.parentRevisionId,
    });

    // Copy chapters
    await ctx.runAction(internal.cleanupPatchApply.copyChaptersForNewRevision, {
      bookId: args.bookId,
      parentRevisionId: args.parentRevisionId,
      newRevisionId,
      newRevisionFileId: fileId,
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
export const rollbackToRevision = internalAction({
  args: {
    bookId: v.id("books"),
    targetRevisionId: v.id("cleanupRevisions"),
    reason: v.string(),
    userId: v.id("users"),
  },
  returns: v.object({
    newRevisionId: v.id("cleanupRevisions"),
  }),
  handler: async (ctx, args): Promise<{ newRevisionId: Id<"cleanupRevisions"> }> => {
    // Get current latest revision
    const currentRevision = await ctx.runQuery(internal.cleanupPatchApply.getLatestRevision, {
      bookId: args.bookId,
    });
    if (!currentRevision) {
      throw new Error("No current revision found");
    }

    // Get target revision
    const targetRevision = await ctx.runQuery(internal.cleanupPatchApply.getRevisionMetadata, {
      revisionId: args.targetRevisionId,
    });
    if (!targetRevision) {
      throw new Error(`Target revision ${args.targetRevisionId} not found`);
    }

    // Read target content from file storage
    if (!targetRevision.fileId) {
      throw new Error(`Target revision ${args.targetRevisionId} has no fileId (legacy data)`);
    }
    const contentBlob = await ctx.storage.get(targetRevision.fileId);
    if (!contentBlob) {
      throw new Error(`Content file ${targetRevision.fileId} not found for target revision`);
    }
    const content = await contentBlob.text();

    // Store content as new file
    const newBlob = new Blob([content], { type: "text/plain" });
    const newFileId = await ctx.storage.store(newBlob);

    // Create new revision with file reference
    const newRevisionId = await ctx.runMutation(internal.cleanupPatchApply.createRevisionRecord, {
      bookId: args.bookId,
      revisionNumber: currentRevision.revisionNumber + 1,
      fileId: newFileId,
      sizeBytes: newBlob.size,
      isDeterministic: false,
      isAiAssisted: false,
      preserveArchaic: targetRevision.preserveArchaic,
      parentRevisionId: currentRevision._id,
    });

    // Copy chapters from target revision (using file storage)
    await ctx.runAction(internal.cleanupPatchApply.copyChaptersForNewRevision, {
      bookId: args.bookId,
      parentRevisionId: args.targetRevisionId,
      newRevisionId,
      newRevisionFileId: newFileId,
    });

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

// =============================================================================
// Helper queries and mutations for file storage pattern
// =============================================================================

export const getRevisionMetadata = internalQuery({
  args: {
    revisionId: v.id("cleanupRevisions"),
  },
  returns: v.union(v.null(), v.object({
    _id: v.id("cleanupRevisions"),
    bookId: v.id("books"),
    revisionNumber: v.number(),
    fileId: v.optional(v.id("_storage")),
    isDeterministic: v.boolean(),
    isAiAssisted: v.boolean(),
    preserveArchaic: v.boolean(),
  })),
  handler: async (ctx, args) => {
    const revision = await ctx.db.get(args.revisionId);
    if (!revision) return null;
    return {
      _id: revision._id,
      bookId: revision.bookId,
      revisionNumber: revision.revisionNumber,
      fileId: revision.fileId,
      isDeterministic: revision.isDeterministic,
      isAiAssisted: revision.isAiAssisted,
      preserveArchaic: revision.preserveArchaic,
    };
  },
});

export const createRevisionRecord = internalMutation({
  args: {
    bookId: v.id("books"),
    revisionNumber: v.number(),
    fileId: v.id("_storage"),
    sizeBytes: v.number(),
    isDeterministic: v.boolean(),
    isAiAssisted: v.boolean(),
    preserveArchaic: v.boolean(),
    parentRevisionId: v.id("cleanupRevisions"),
  },
  returns: v.id("cleanupRevisions"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("cleanupRevisions", {
      bookId: args.bookId,
      revisionNumber: args.revisionNumber,
      fileId: args.fileId,
      sizeBytes: args.sizeBytes,
      isDeterministic: args.isDeterministic,
      isAiAssisted: args.isAiAssisted,
      preserveArchaic: args.preserveArchaic,
      createdAt: Date.now(),
      createdBy: "ai",
      parentRevisionId: args.parentRevisionId,
    });
  },
});

export const createFlagsBatch = internalMutation({
  args: {
    flags: v.array(v.object({
      bookId: v.id("books"),
      revisionId: v.id("cleanupRevisions"),
      type: v.literal("low_confidence_cleanup"),
      status: v.literal("unresolved"),
      startOffset: v.number(),
      endOffset: v.number(),
      contextText: v.string(),
      suggestedAction: v.string(),
    })),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let count = 0;
    for (const flag of args.flags) {
      await ctx.db.insert("cleanupFlags", {
        ...flag,
        createdAt: Date.now(),
      });
      count++;
    }
    return count;
  },
});

export const getLatestRevision = internalQuery({
  args: {
    bookId: v.id("books"),
  },
  returns: v.union(v.null(), v.object({
    _id: v.id("cleanupRevisions"),
    revisionNumber: v.number(),
  })),
  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query("cleanupRevisions")
      .withIndex("by_book_id_revision", q => q.eq("bookId", args.bookId))
      .order("desc")
      .first();
    if (!latest) return null;
    return { _id: latest._id, revisionNumber: latest.revisionNumber };
  },
});

export const getChaptersForCopy = internalQuery({
  args: {
    revisionId: v.id("cleanupRevisions"),
  },
  returns: v.array(v.object({
    chapterNumber: v.number(),
    title: v.string(),
    type: v.union(
      v.literal("chapter"),
      v.literal("preface"),
      v.literal("introduction"),
      v.literal("notes"),
      v.literal("appendix"),
      v.literal("body"),
    ),
    startOffset: v.number(),
    endOffset: v.number(),
    detectedHeading: v.optional(v.string()),
    isUserConfirmed: v.boolean(),
  })),
  handler: async (ctx, args) => {
    const chapters = await ctx.db
      .query("cleanupChapters")
      .withIndex("by_revision_id", q => q.eq("revisionId", args.revisionId))
      .order("asc")
      .collect();
    return chapters.map(ch => ({
      chapterNumber: ch.chapterNumber,
      title: ch.title,
      type: ch.type,
      startOffset: ch.startOffset,
      endOffset: ch.endOffset,
      detectedHeading: ch.detectedHeading,
      isUserConfirmed: ch.isUserConfirmed,
    }));
  },
});

export const createChaptersBatch = internalMutation({
  args: {
    chapters: v.array(v.object({
      bookId: v.id("books"),
      revisionId: v.id("cleanupRevisions"),
      chapterNumber: v.number(),
      title: v.string(),
      type: v.union(
        v.literal("chapter"),
        v.literal("preface"),
        v.literal("introduction"),
        v.literal("notes"),
        v.literal("appendix"),
        v.literal("body"),
      ),
      fileId: v.id("_storage"),
      startOffset: v.number(),
      endOffset: v.number(),
      detectedHeading: v.optional(v.string()),
      isUserConfirmed: v.boolean(),
      sizeBytes: v.number(),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const chapter of args.chapters) {
      await ctx.db.insert("cleanupChapters", {
        ...chapter,
        createdAt: Date.now(),
      });
    }
    return null;
  },
});
