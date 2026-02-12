/**
 * Review flag lifecycle management
 * 
 * Handles creation, resolution, and querying of cleanup review flags.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

/**
 * Flag types for different cleanup ambiguities
 */
export type CleanupFlagType =
  | "unlabeled_boundary_candidate"
  | "low_confidence_cleanup"
  | "ocr_corruption_detected"
  | "ambiguous_punctuation"
  | "chapter_boundary_disputed";

/**
 * Flag status lifecycle
 */
export type CleanupFlagStatus =
  | "unresolved"
  | "confirmed"
  | "rejected"
  | "overridden";

/**
 * Internal mutation to create a review flag
 */
export const createReviewFlag = internalMutation({
  args: {
    bookId: v.id("books"),
    revisionId: v.id("cleanupRevisions"),
    type: v.union(
      v.literal("unlabeled_boundary_candidate"),
      v.literal("low_confidence_cleanup"),
      v.literal("ocr_corruption_detected"),
      v.literal("ambiguous_punctuation"),
      v.literal("chapter_boundary_disputed"),
    ),
    chapterId: v.optional(v.id("cleanupChapters")),
    startOffset: v.number(),
    endOffset: v.number(),
    contextText: v.string(),
    suggestedAction: v.optional(v.string()),
  },
  returns: v.id("cleanupFlags"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("cleanupFlags", {
      bookId: args.bookId,
      revisionId: args.revisionId,
      type: args.type,
      status: "unresolved",
      chapterId: args.chapterId,
      startOffset: args.startOffset,
      endOffset: args.endOffset,
      contextText: args.contextText,
      suggestedAction: args.suggestedAction,
      createdAt: Date.now(),
    });
  },
});

/**
 * Internal mutation to resolve a flag
 */
export const resolveFlag = internalMutation({
  args: {
    flagId: v.id("cleanupFlags"),
    status: v.union(v.literal("confirmed"), v.literal("rejected"), v.literal("overridden")),
    reviewerNote: v.optional(v.string()),
    userId: v.id("users"),
  },
  returns: v.object({ action: v.string(), flag: v.any() }),
  handler: async (ctx, args) => {
    const flag = await ctx.db.get(args.flagId);
    if (!flag) {
      throw new Error(`Flag ${args.flagId} not found`);
    }

    await ctx.db.patch(args.flagId, {
      status: args.status,
      reviewerNote: args.reviewerNote,
      resolvedAt: Date.now(),
      resolvedBy: args.userId,
    });

    // If confirming an unlabeled boundary, mark need for chapter split
    if (flag.type === "unlabeled_boundary_candidate" && args.status === "confirmed") {
      // The chapter split will be handled by the caller
      return { action: "create_chapter_split", flag };
    }

    return { action: "resolved", flag };
  },
});

/**
 * Internal query to get flags for a book
 */
export const getFlagsByBook = internalQuery({
  args: {
    bookId: v.id("books"),
    status: v.optional(v.union(
      v.literal("unresolved"),
      v.literal("confirmed"),
      v.literal("rejected"),
      v.literal("overridden"),
    )),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let queryBuilder = ctx.db.query("cleanupFlags")
      .withIndex("by_book_id", q => q.eq("bookId", args.bookId));

    if (args.status) {
      queryBuilder = queryBuilder.filter(q => q.eq(q.field("status"), args.status));
    }

    return await queryBuilder.collect();
  },
});

/**
 * Internal query to get flags by revision
 */
export const getFlagsByRevision = internalQuery({
  args: {
    revisionId: v.id("cleanupRevisions"),
    status: v.optional(v.union(
      v.literal("unresolved"),
      v.literal("confirmed"),
      v.literal("rejected"),
      v.literal("overridden"),
    )),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let queryBuilder = ctx.db.query("cleanupFlags")
      .withIndex("by_revision_id", q => q.eq("revisionId", args.revisionId));

    if (args.status) {
      queryBuilder = queryBuilder.filter(q => q.eq(q.field("status"), args.status));
    }

    return await queryBuilder.collect();
  },
});

/**
 * Internal query to check if book has unresolved flags
 */
export const hasUnresolvedFlags = internalQuery({
  args: {
    bookId: v.id("books"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const flags = await ctx.db.query("cleanupFlags")
      .withIndex("by_book_status", q => q.eq("bookId", args.bookId).eq("status", "unresolved"))
      .collect();
    
    return flags.length > 0;
  },
});

/**
 * Internal mutation to batch create flags from cleanup results
 */
export const batchCreateFlagsFromResults = internalMutation({
  args: {
    bookId: v.id("books"),
    revisionId: v.id("cleanupRevisions"),
    unlabeledBreaks: v.array(v.object({
      offset: v.number(),
      pattern: v.string(),
      lineNumber: v.number(),
    })),
    ambiguousPositions: v.array(v.object({
      offset: v.number(),
      context: v.string(),
      lineNumber: v.number(),
    })),
    lowConfidencePunctuation: v.array(v.object({
      offset: v.number(),
      context: v.string(),
      lineNumber: v.number(),
    })),
    startMarkerFound: v.boolean(),
    endMarkerFound: v.boolean(),
  },
  returns: v.array(v.id("cleanupFlags")),
  handler: async (ctx, args) => {
    const flagIds = [];

    // Create flags for unlabeled breaks
    for (const break_ of args.unlabeledBreaks) {
      const id = await ctx.db.insert("cleanupFlags", {
        bookId: args.bookId,
        revisionId: args.revisionId,
        type: "unlabeled_boundary_candidate",
        status: "unresolved",
        startOffset: break_.offset,
        endOffset: break_.offset + break_.pattern.length,
        contextText: `Section break at line ${break_.lineNumber}: "${break_.pattern.slice(0, 50)}"`,
        suggestedAction: "Review and confirm if this is a chapter boundary",
        createdAt: Date.now(),
      });
      flagIds.push(id);
    }

    // Create flags for ambiguous paragraph unwrapping
    for (const pos of args.ambiguousPositions) {
      const id = await ctx.db.insert("cleanupFlags", {
        bookId: args.bookId,
        revisionId: args.revisionId,
        type: "low_confidence_cleanup",
        status: "unresolved",
        startOffset: pos.offset,
        endOffset: pos.offset + pos.context.length,
        contextText: `Ambiguous paragraph structure at line ${pos.lineNumber}: "${pos.context.slice(0, 100)}"`,
        suggestedAction: "Verify paragraph boundaries are correct",
        createdAt: Date.now(),
      });
      flagIds.push(id);
    }

    // Create flags for low-confidence punctuation
    for (const pos of args.lowConfidencePunctuation) {
      const id = await ctx.db.insert("cleanupFlags", {
        bookId: args.bookId,
        revisionId: args.revisionId,
        type: "ambiguous_punctuation",
        status: "unresolved",
        startOffset: pos.offset,
        endOffset: pos.offset + pos.context.length,
        contextText: `Punctuation at line ${pos.lineNumber}: "${pos.context.slice(0, 100)}"`,
        suggestedAction: "Verify punctuation is correct (archaic forms preserved)",
        createdAt: Date.now(),
      });
      flagIds.push(id);
    }

    // Flag missing boilerplate markers
    if (!args.startMarkerFound) {
      const id = await ctx.db.insert("cleanupFlags", {
        bookId: args.bookId,
        revisionId: args.revisionId,
        type: "ocr_corruption_detected",
        status: "unresolved",
        startOffset: 0,
        endOffset: 100,
        contextText: "Start of book marker not detected",
        suggestedAction: "Verify boilerplate removal didn't truncate content",
        createdAt: Date.now(),
      });
      flagIds.push(id);
    }

    if (!args.endMarkerFound) {
      const id = await ctx.db.insert("cleanupFlags", {
        bookId: args.bookId,
        revisionId: args.revisionId,
        type: "ocr_corruption_detected",
        status: "unresolved",
        startOffset: 0,
        endOffset: 100,
        contextText: "End of book marker not detected",
        suggestedAction: "Verify boilerplate removal didn't truncate content",
        createdAt: Date.now(),
      });
      flagIds.push(id);
    }

    return flagIds;
  },
});

/**
 * Internal mutation to create a flag for OCR-corrupted chapter heading
 */
export const createOcrChapterFlag = internalMutation({
  args: {
    bookId: v.id("books"),
    revisionId: v.id("cleanupRevisions"),
    chapterId: v.id("cleanupChapters"),
    rawHeading: v.string(),
    lineNumber: v.number(),
  },
  returns: v.id("cleanupFlags"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("cleanupFlags", {
      bookId: args.bookId,
      revisionId: args.revisionId,
      type: "ocr_corruption_detected",
      status: "unresolved",
      chapterId: args.chapterId,
      startOffset: 0,
      endOffset: args.rawHeading.length,
      contextText: `OCR-corrupted heading at line ${args.lineNumber}: "${args.rawHeading}"`,
      suggestedAction: "Verify chapter heading is correctly interpreted",
      createdAt: Date.now(),
    });
  },
});

/**
 * Internal mutation to promote an unlabeled break to a chapter
 */
export const promoteBoundaryToChapter = internalMutation({
  args: {
    bookId: v.id("books"),
    revisionId: v.id("cleanupRevisions"),
    flagId: v.id("cleanupFlags"),
    title: v.string(),
    type: v.union(
      v.literal("chapter"),
      v.literal("preface"),
      v.literal("introduction"),
      v.literal("notes"),
      v.literal("appendix"),
      v.literal("body"),
    ),
    chapterNumber: v.number(),
  },
  returns: v.object({ chapterId: v.id("cleanupChapters") }),
  handler: async (ctx, args) => {
    // Get the revision to extract content around the boundary
    const revision = await ctx.db.get(args.revisionId);
    if (!revision) {
      throw new Error(`Revision ${args.revisionId} not found`);
    }

    const flag = await ctx.db.get(args.flagId);
    if (!flag) {
      throw new Error(`Flag ${args.flagId} not found`);
    }

    // Create the new chapter
    const content = revision.content.slice(flag.startOffset, flag.endOffset + 1000);
    const chapterId = await ctx.db.insert("cleanupChapters", {
      bookId: args.bookId,
      revisionId: args.revisionId,
      chapterNumber: args.chapterNumber,
      title: args.title,
      type: args.type,
      content,
      startOffset: flag.startOffset,
      endOffset: flag.endOffset + 1000,
      detectedHeading: undefined,
      isUserConfirmed: true,
      createdAt: Date.now(),
    });

    // Update the flag
    await ctx.db.patch(args.flagId, {
      status: "confirmed",
      chapterId,
      resolvedAt: Date.now(),
    });

    return { chapterId };
  },
});

// =============================================================================
// Public Queries for Approval Gating (CLEAN-03)
// =============================================================================

/**
 * List review flags for a book with optional status filter
 * 
 * Usage per plan verification:
 *   npx convex run cleanupFlags:listReviewFlags '{"bookId":"...","status":"unresolved"}'
 */
export const listReviewFlags = query({
  args: {
    bookId: v.id("books"),
    status: v.optional(v.union(
      v.literal("unresolved"),
      v.literal("confirmed"),
      v.literal("rejected"),
      v.literal("overridden"),
    )),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let queryBuilder = ctx.db.query("cleanupFlags")
      .withIndex("by_book_id", q => q.eq("bookId", args.bookId));

    if (args.status) {
      queryBuilder = queryBuilder.filter(q => q.eq(q.field("status"), args.status));
    }

    return await queryBuilder.order("desc").collect();
  },
});

/**
 * Get count of unresolved flags for approval gating
 */
export const getUnresolvedFlagCount = query({
  args: {
    bookId: v.id("books"),
  },
  returns: v.object({
    total: v.number(),
    byType: v.object({
      unlabeled_boundary_candidate: v.number(),
      low_confidence_cleanup: v.number(),
      ocr_corruption_detected: v.number(),
      ambiguous_punctuation: v.number(),
      chapter_boundary_disputed: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const flags = await ctx.db
      .query("cleanupFlags")
      .withIndex("by_book_status", q => q.eq("bookId", args.bookId).eq("status", "unresolved"))
      .collect();

    const byType = {
      unlabeled_boundary_candidate: 0,
      low_confidence_cleanup: 0,
      ocr_corruption_detected: 0,
      ambiguous_punctuation: 0,
      chapter_boundary_disputed: 0,
    };

    for (const flag of flags) {
      byType[flag.type as keyof typeof byType]++;
    }

    return {
      total: flags.length,
      byType,
    };
  },
});
