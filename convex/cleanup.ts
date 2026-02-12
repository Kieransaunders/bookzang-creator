/**
 * Public cleanup API surface
 * 
 * Queries and mutations for starting cleanup, retrieving review data,
 * and managing the cleanup pipeline.
 */

import { v } from "convex/values";
import { query, mutation, internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { runDeterministicCleanup } from "./cleanupPipeline";
import { detectChapterBoundaries } from "./cleanupChaptering";

/**
 * Start deterministic cleanup for a book
 * Creates the original snapshot, runs cleanup, creates revision and chapters
 */
export const startCleanup = mutation({
  args: {
    bookId: v.id("books"),
    preserveArchaic: v.optional(v.boolean()),
  },
  returns: v.object({ jobId: v.id("cleanupJobs"), status: v.string() }),
  handler: async (ctx, args) => {
    // Get the book
    const book = await ctx.db.get(args.bookId);
    if (!book) {
      throw new Error(`Book ${args.bookId} not found`);
    }

    // Check if file exists
    if (!book.fileId) {
      throw new Error(`Book ${args.bookId} has no file`);
    }

    // Check for existing cleanup job
    const existingJob = await ctx.db.query("cleanupJobs")
      .withIndex("by_book_id", q => q.eq("bookId", args.bookId))
      .filter(q => q.eq(q.field("status"), "running"))
      .first();

    if (existingJob) {
      throw new Error(`Cleanup already in progress for book ${args.bookId}`);
    }

    // Create cleanup job
    const jobId = await ctx.db.insert("cleanupJobs", {
      bookId: args.bookId,
      stage: "queued",
      status: "queued",
      progress: 0,
      flagsCreated: 0,
      queuedAt: Date.now(),
    });

    // Start the cleanup pipeline (async)
    await ctx.scheduler.runAfter(0, internal.cleanup.runCleanupPipeline, {
      bookId: args.bookId,
      fileId: book.fileId,
      jobId,
      preserveArchaic: args.preserveArchaic ?? true,
    });

    return { jobId, status: "queued" };
  },
});

/**
 * Internal action to run the full cleanup pipeline
 */
export const runCleanupPipeline: ReturnType<typeof internalAction> = internalAction({
  args: {
    bookId: v.id("books"),
    fileId: v.id("_storage"),
    jobId: v.id("cleanupJobs"),
    preserveArchaic: v.boolean(),
  },
  returns: v.object({
    success: v.boolean(),
    revisionId: v.optional(v.id("cleanupRevisions")),
    chaptersDetected: v.optional(v.number()),
    flagsCreated: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    try {
      // Update job to loading stage
      await ctx.runMutation(internal.cleanup.updateJobStage, {
        jobId: args.jobId,
        stage: "loading_original",
        progress: 10,
      });

      // Load the file content
      const blob = await ctx.storage.get(args.fileId);
      if (!blob) {
        throw new Error(`File ${args.fileId} not found in storage`);
      }

      const originalContent = await blob.text();

      // Store original
      await ctx.runMutation(internal.cleanup.insertOriginal, {
        bookId: args.bookId,
        content: originalContent,
        sourceFormat: "gutenberg_txt",
      });

      // Run deterministic cleanup
      await ctx.runMutation(internal.cleanup.updateJobStage, {
        jobId: args.jobId,
        stage: "boilerplate_removal",
        progress: 30,
      });

      const cleanupResult = runDeterministicCleanup(originalContent, {
        preserveArchaic: args.preserveArchaic,
        unwrapParagraphs: true,
        normalizePunctuation: true,
      });

      // Create cleaned revision
      await ctx.runMutation(internal.cleanup.updateJobStage, {
        jobId: args.jobId,
        stage: "punctuation_normalization",
        progress: 50,
      });

      const revisionId = await ctx.runMutation(internal.cleanupPipeline.createCleanupRevision, {
        bookId: args.bookId,
        revisionNumber: 1,
        content: cleanupResult.content,
        isDeterministic: true,
        isAiAssisted: false,
        preserveArchaic: args.preserveArchaic,
        createdBy: "system",
      });

      // Detect and create chapters
      await ctx.runMutation(internal.cleanup.updateJobStage, {
        jobId: args.jobId,
        stage: "chapter_detection",
        progress: 70,
      });

      const chapterResult = detectChapterBoundaries(cleanupResult.content);

      // Prepare chapters for insertion
      const chaptersForDb = chapterResult.chapters.map(ch => ({
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        type: ch.type,
        content: ch.content,
        startOffset: ch.startOffset,
        endOffset: ch.endOffset,
        detectedHeading: ch.detectedHeading ?? undefined,
        isUserConfirmed: ch.isUserConfirmed,
        confidence: ch.confidence,
        isOcrCorrupted: ch.isOcrCorrupted,
      }));

      const chapterIds = await ctx.runMutation(internal.cleanupPipeline.createChapterRecords, {
        bookId: args.bookId,
        revisionId,
        chapters: chaptersForDb,
      });

      // Create OCR flags for corrupted headings
      for (let i = 0; i < chapterResult.chapters.length; i++) {
        const ch = chapterResult.chapters[i];
        if (ch.isOcrCorrupted) {
          await ctx.runMutation(internal.cleanupFlags.createOcrChapterFlag, {
            bookId: args.bookId,
            revisionId,
            chapterId: chapterIds[i],
            rawHeading: ch.detectedHeading || "Unknown",
            lineNumber: 0,
          });
        }
      }

      // Create flags for ambiguous content
      await ctx.runMutation(internal.cleanup.updateJobStage, {
        jobId: args.jobId,
        stage: "completed",
        progress: 90,
      });

      const flagIds = await ctx.runMutation(internal.cleanupFlags.batchCreateFlagsFromResults, {
        bookId: args.bookId,
        revisionId,
        unlabeledBreaks: cleanupResult.unlabeledBreaks,
        ambiguousPositions: cleanupResult.ambiguousPositions,
        lowConfidencePunctuation: cleanupResult.lowConfidencePunctuation,
        startMarkerFound: cleanupResult.startMarkerFound,
        endMarkerFound: cleanupResult.endMarkerFound,
      });

      // Update job to completed
      await ctx.runMutation(internal.cleanup.completeJob, {
        jobId: args.jobId,
        revisionId,
        chaptersDetected: chapterResult.chapters.length,
        flagsCreated: flagIds.length + chapterResult.chapters.filter(c => c.isOcrCorrupted).length,
      });

      // Update book status
      await ctx.runMutation(internal.cleanup.updateBookStatus, {
        bookId: args.bookId,
        status: "cleaned",
      });

      return {
        success: true,
        revisionId,
        chaptersDetected: chapterResult.chapters.length,
        flagsCreated: flagIds.length,
      };

    } catch (error) {
      // Update job to failed
      await ctx.runMutation(internal.cleanup.failJob, {
        jobId: args.jobId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});

/**
 * Get review data for a book
 */
export const getReviewData = query({
  args: {
    bookId: v.id("books"),
  },
  returns: v.object({
    book: v.any(),
    original: v.any(),
    revision: v.any(),
    chapters: v.array(v.any()),
    unresolvedFlags: v.array(v.any()),
    canApprove: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Get the book
    const book = await ctx.db.get(args.bookId);
    if (!book) {
      throw new Error(`Book ${args.bookId} not found`);
    }

    // Get latest revision
    const revisions = await ctx.db.query("cleanupRevisions")
      .withIndex("by_book_id_revision", q => q.eq("bookId", args.bookId))
      .order("desc")
      .take(1);

    const latestRevision = revisions[0];

    // Get chapters for latest revision
    const chapters = latestRevision
      ? await ctx.db.query("cleanupChapters")
          .withIndex("by_revision_id", q => q.eq("revisionId", latestRevision._id))
          .order("asc")
          .collect()
      : [];

    // Get unresolved flags
    const flags = latestRevision
      ? await ctx.db.query("cleanupFlags")
          .withIndex("by_book_status", q => q.eq("bookId", args.bookId).eq("status", "unresolved"))
          .collect()
      : [];

    // Get original content
    const originals = await ctx.db.query("cleanupOriginals")
      .withIndex("by_book_id", q => q.eq("bookId", args.bookId))
      .collect();

    return {
      book,
      original: originals[0] || null,
      revision: latestRevision || null,
      chapters,
      unresolvedFlags: flags,
      canApprove: flags.length === 0 && latestRevision !== null,
    };
  },
});

/**
 * List review flags for a book
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
    let query_ = ctx.db.query("cleanupFlags")
      .withIndex("by_book_id", q => q.eq("bookId", args.bookId));

    if (args.status) {
      query_ = query_.filter(q => q.eq(q.field("status"), args.status));
    }

    return await query_.order("desc").collect();
  },
});

/**
 * Resolve a review flag
 */
export const resolveFlag: ReturnType<typeof mutation> = mutation({
  args: {
    flagId: v.id("cleanupFlags"),
    status: v.union(v.literal("confirmed"), v.literal("rejected"), v.literal("overridden")),
    reviewerNote: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<{ action: string; flag: unknown }> => {
    // Get current user from auth context
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error("Must be authenticated to resolve flags");
    }

    // Look up the user by email - users table from auth doesn't have custom indexes
    const userRecord = await ctx.db.query("users")
      .withIndex("email", q => q.eq("email", user.email))
      .first();

    if (!userRecord) {
      throw new Error("User not found in database");
    }

    return await ctx.runMutation(internal.cleanupFlags.resolveFlag, {
      flagId: args.flagId,
      status: args.status,
      reviewerNote: args.reviewerNote,
      userId: userRecord._id,
    });
  },
});

/**
 * Promote an unlabeled boundary to a chapter
 */
export const promoteBoundaryToChapter: ReturnType<typeof mutation> = mutation({
  args: {
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
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const flag = await ctx.db.get(args.flagId);
    if (!flag) {
      throw new Error(`Flag ${args.flagId} not found`);
    }

    // Get current max chapter number for this revision
    const chapters = await ctx.db.query("cleanupChapters")
      .withIndex("by_revision_id", q => q.eq("revisionId", flag.revisionId))
      .collect();

    const maxChapter = chapters.reduce((max, ch) => Math.max(max, ch.chapterNumber), 0);

    return await ctx.runMutation(internal.cleanupFlags.promoteBoundaryToChapter, {
      bookId: flag.bookId,
      revisionId: flag.revisionId,
      flagId: args.flagId,
      title: args.title,
      type: args.type,
      chapterNumber: maxChapter + 1,
    });
  },
});

/**
 * Save a new cleaned revision from reviewer edits
 * Creates a new revision with user as the creator
 * 
 * POST-APPROVAL EDIT HANDLING:
 * If the book has an active approval and keepApproval is not specified,
   the caller must prompt for keep/revoke choice. If keepApproval is true,
   the new revision becomes the approved revision. If keepApproval is false
 * or unspecified with existing approval, approval is revoked.
 */
export const saveCleanedRevision = mutation({
  args: {
    bookId: v.id("books"),
    content: v.string(),
    parentRevisionId: v.optional(v.id("cleanupRevisions")),
    keepApproval: v.optional(v.boolean()),
  },
  returns: v.object({
    revisionId: v.id("cleanupRevisions"),
    revisionNumber: v.number(),
    approvalRevoked: v.boolean(),
    approvalKept: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Get current user
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error("Must be authenticated to save revisions");
    }

    const userRecord = await ctx.db.query("users")
      .withIndex("email", q => q.eq("email", user.email))
      .first();

    if (!userRecord) {
      throw new Error("User not found");
    }

    // Verify book exists
    const book = await ctx.db.get(args.bookId);
    if (!book) {
      throw new Error(`Book ${args.bookId} not found`);
    }

    // Get the latest revision to determine new revision number
    const latestRevisions = await ctx.db.query("cleanupRevisions")
      .withIndex("by_book_id_revision", q => q.eq("bookId", args.bookId))
      .order("desc")
      .take(1);

    const latestRevision = latestRevisions[0];
    const newRevisionNumber = latestRevision ? latestRevision.revisionNumber + 1 : 1;

    // Inherit properties from parent revision if available
    const isDeterministic = latestRevision?.isDeterministic ?? false;
    const isAiAssisted = latestRevision?.isAiAssisted ?? false;
    const preserveArchaic = latestRevision?.preserveArchaic ?? true;

    // Check if there's an active approval
    const approvals = await ctx.db
      .query("cleanupApprovals")
      .withIndex("by_book_id", q => q.eq("bookId", args.bookId))
      .order("desc")
      .take(1);

    const latestApproval = approvals[0];
    const hasActiveApproval = latestApproval !== undefined;

    // Determine approval action
    let approvalRevoked = false;
    let approvalKept = false;

    if (hasActiveApproval) {
      if (args.keepApproval === true) {
        // User chose to keep approval - new revision becomes approved
        approvalKept = true;
      } else {
        // No keep specified, or explicitly revoked - revoke approval
        await ctx.db.patch(args.bookId, { status: "cleaned" });
        approvalRevoked = true;
      }
    }

    // Create new revision
    const revisionId = await ctx.db.insert("cleanupRevisions", {
      bookId: args.bookId,
      revisionNumber: newRevisionNumber,
      content: args.content,
      isDeterministic,
      isAiAssisted,
      preserveArchaic,
      createdAt: Date.now(),
      createdBy: "user",
      parentRevisionId: args.parentRevisionId ?? latestRevision?._id,
    });

    // If keeping approval, create new approval record for this revision
    if (approvalKept && latestApproval) {
      await ctx.db.insert("cleanupApprovals", {
        bookId: args.bookId,
        revisionId,
        approvedBy: userRecord._id,
        approvedAt: Date.now(),
        checklistConfirmed: latestApproval.checklistConfirmed,
      });

      // Update book status back to ready
      await ctx.db.patch(args.bookId, { status: "ready" });
    }

    return {
      revisionId,
      revisionNumber: newRevisionNumber,
      approvalRevoked,
      approvalKept,
    };
  },
});

/**
 * Get cleanup job status
 */
export const getCleanupStatus = query({
  args: {
    bookId: v.id("books"),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const jobs = await ctx.db.query("cleanupJobs")
      .withIndex("by_book_id", q => q.eq("bookId", args.bookId))
      .order("desc")
      .take(1);

    return jobs[0] || null;
  },
});

/**
 * Get cleanup statuses for multiple books (for polling)
 */
export const getCleanupStatusesForBooks = query({
  args: {
    bookIds: v.array(v.id("books")),
  },
  returns: v.array(v.union(v.null(), v.object({
    bookId: v.string(),
    status: v.union(v.literal("queued"), v.literal("running"), v.literal("completed"), v.literal("failed")),
    stage: v.optional(v.string()),
    progress: v.optional(v.number()),
    error: v.optional(v.string()),
  }))),
  handler: async (ctx, args) => {
    const results = [];
    
    for (const bookId of args.bookIds) {
      const job = await ctx.db.query("cleanupJobs")
        .withIndex("by_book_id", q => q.eq("bookId", bookId))
        .order("desc")
        .first();
      
      if (job) {
        results.push({
          bookId,
          status: job.status,
          stage: job.stage,
          progress: job.progress,
          error: job.error,
        });
      } else {
        results.push(null);
      }
    }
    
    return results;
  },
});

// ─── Internal mutations for pipeline coordination ───────────────────────────

/**
 * Insert original record
 */
export const insertOriginal = internalMutation({
  args: {
    bookId: v.id("books"),
    content: v.string(),
    sourceFormat: v.union(v.literal("gutenberg_txt"), v.literal("markdown")),
  },
  returns: v.id("cleanupOriginals"),
  handler: async (ctx, args) => {
    // Check if original already exists
    const existing = await ctx.db.query("cleanupOriginals")
      .withIndex("by_book_id", q => q.eq("bookId", args.bookId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("cleanupOriginals", {
      bookId: args.bookId,
      content: args.content,
      capturedAt: Date.now(),
      sourceFormat: args.sourceFormat,
    });
  },
});

/**
 * Update job stage
 */
export const updateJobStage = internalMutation({
  args: {
    jobId: v.id("cleanupJobs"),
    stage: v.union(
      v.literal("queued"),
      v.literal("loading_original"),
      v.literal("boilerplate_removal"),
      v.literal("paragraph_unwrap"),
      v.literal("chapter_detection"),
      v.literal("punctuation_normalization"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    progress: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const update: Record<string, unknown> = {
      stage: args.stage,
      progress: args.progress,
    };

    if (args.stage === "loading_original") {
      const job = await ctx.db.get(args.jobId);
      if (job && !job.startedAt) {
        update.startedAt = Date.now();
        update.status = "running";
      }
    }

    await ctx.db.patch(args.jobId, update);
    return null;
  },
});

/**
 * Complete cleanup job
 */
export const completeJob = internalMutation({
  args: {
    jobId: v.id("cleanupJobs"),
    revisionId: v.id("cleanupRevisions"),
    chaptersDetected: v.number(),
    flagsCreated: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "completed",
      stage: "completed",
      revisionId: args.revisionId,
      chaptersDetected: args.chaptersDetected,
      flagsCreated: args.flagsCreated,
      progress: 100,
      completedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Fail cleanup job
 */
export const failJob = internalMutation({
  args: {
    jobId: v.id("cleanupJobs"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "failed",
      error: args.error,
    });
    return null;
  },
});

/**
 * Update book status
 */
export const updateBookStatus = internalMutation({
  args: {
    bookId: v.id("books"),
    status: v.union(
      v.literal("discovered"),
      v.literal("importing"),
      v.literal("imported"),
      v.literal("failed"),
      v.literal("cleaned"),
      v.literal("ready"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.bookId, { status: args.status });
    return null;
  },
});

// =============================================================================
// Approval Gating - CLEAN-03 requirement: approval blocked by unresolved flags
// =============================================================================

/**
 * Check if a book can be approved (no unresolved flags)
 * This enforces the approval gate requirement from CONTEXT.md
 */
export const canApprove = query({
  args: {
    bookId: v.id("books"),
  },
  returns: v.object({
    canApprove: v.boolean(),
    unresolvedFlagCount: v.number(),
    blockingFlags: v.array(v.any()),
    latestRevision: v.any(),
  }),
  handler: async (ctx, args) => {
    // Get latest revision
    const revisions = await ctx.db
      .query("cleanupRevisions")
      .withIndex("by_book_id_revision", q => q.eq("bookId", args.bookId))
      .order("desc")
      .take(1);

    const latestRevision = revisions[0];

    if (!latestRevision) {
      return {
        canApprove: false,
        unresolvedFlagCount: 0,
        blockingFlags: [],
        latestRevision: null,
      };
    }

    // Get unresolved flags for this book
    const flags = await ctx.db
      .query("cleanupFlags")
      .withIndex("by_book_status", q => q.eq("bookId", args.bookId).eq("status", "unresolved"))
      .collect();

    // Can only approve if no unresolved flags exist
    const canApprove = flags.length === 0;

    return {
      canApprove,
      unresolvedFlagCount: flags.length,
      blockingFlags: flags,
      latestRevision,
    };
  },
});

/**
 * Approve a cleaned revision
 * BLOCKED if unresolved low-confidence flags exist (per CONTEXT.md)
 * 
 * Approval checklist confirmation must be completed before calling this.
 */
export const approveRevision = mutation({
  args: {
    bookId: v.id("books"),
    revisionId: v.id("cleanupRevisions"),
    checklistConfirmed: v.object({
      boilerplateRemoved: v.boolean(),
      chapterBoundariesVerified: v.boolean(),
      punctuationReviewed: v.boolean(),
      archaicPreserved: v.boolean(),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    approvedRevisionId: v.optional(v.id("cleanupRevisions")),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Verify all checklist items confirmed
    const checklist = args.checklistConfirmed;
    const allConfirmed = checklist.boilerplateRemoved &&
                        checklist.chapterBoundariesVerified &&
                        checklist.punctuationReviewed &&
                        checklist.archaicPreserved;

    if (!allConfirmed) {
      return {
        success: false,
        error: "All checklist items must be confirmed before approval",
      };
    }

    // CRITICAL: Check for unresolved flags - this is the approval gate
    const unresolvedFlags = await ctx.db
      .query("cleanupFlags")
      .withIndex("by_book_status", q => q.eq("bookId", args.bookId).eq("status", "unresolved"))
      .collect();

    if (unresolvedFlags.length > 0) {
      return {
        success: false,
        error: `Cannot approve: ${unresolvedFlags.length} unresolved flag(s) require review. Resolve all low-confidence cleanup flags before approving.`,
      };
    }

    // Get the revision
    const revision = await ctx.db.get(args.revisionId);
    if (!revision) {
      return {
        success: false,
        error: "Revision not found",
      };
    }

    // Verify revision belongs to this book
    if (revision.bookId !== args.bookId) {
      return {
        success: false,
        error: "Revision does not belong to this book",
      };
    }

    // Get current user
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      return {
        success: false,
        error: "Must be authenticated to approve",
      };
    }

    const userRecord = await ctx.db.query("users")
      .withIndex("email", q => q.eq("email", user.email))
      .first();

    if (!userRecord) {
      return {
        success: false,
        error: "User not found",
      };
    }

    // Create approval record
    await ctx.db.insert("cleanupApprovals", {
      bookId: args.bookId,
      revisionId: args.revisionId,
      approvedBy: userRecord._id,
      approvedAt: Date.now(),
      checklistConfirmed: args.checklistConfirmed,
    });

    // Update book status to ready
    await ctx.db.patch(args.bookId, { status: "ready" });

    return {
      success: true,
      approvedRevisionId: args.revisionId,
    };
  },
});

/**
 * Get approval state for a book
 * Returns current approval status with revision awareness
 */
export const getApprovalState = query({
  args: {
    bookId: v.id("books"),
  },
  returns: v.object({
    isApproved: v.boolean(),
    approvedRevisionId: v.optional(v.id("cleanupRevisions")),
    approvedRevisionNumber: v.optional(v.number()),
    approvedAt: v.optional(v.number()),
    approvedBy: v.optional(v.id("users")),
    checklistConfirmed: v.optional(v.any()),
    currentRevisionId: v.optional(v.id("cleanupRevisions")),
    currentRevisionNumber: v.optional(v.number()),
    approvalValid: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Get latest revision
    const revisions = await ctx.db
      .query("cleanupRevisions")
      .withIndex("by_book_id_revision", q => q.eq("bookId", args.bookId))
      .order("desc")
      .take(1);

    const latestRevision = revisions[0];

    // Get latest approval
    const approvals = await ctx.db
      .query("cleanupApprovals")
      .withIndex("by_book_id", q => q.eq("bookId", args.bookId))
      .order("desc")
      .take(1);

    const latestApproval = approvals[0];

    if (!latestApproval) {
      return {
        isApproved: false,
        approvalValid: false,
        currentRevisionId: latestRevision?._id,
        currentRevisionNumber: latestRevision?.revisionNumber,
      };
    }

    // Approval is valid only if it matches the latest revision
    const approvalValid = latestApproval.revisionId === latestRevision?._id;

    return {
      isApproved: true,
      approvedRevisionId: latestApproval.revisionId,
      approvedRevisionNumber: latestRevision?.revisionNumber,
      approvedAt: latestApproval.approvedAt,
      approvedBy: latestApproval.approvedBy,
      checklistConfirmed: latestApproval.checklistConfirmed,
      currentRevisionId: latestRevision?._id,
      currentRevisionNumber: latestRevision?.revisionNumber,
      approvalValid,
    };
  },
});

/**
 * Revoke approval (when edits are made after approval)
 */
export const revokeApproval = mutation({
  args: {
    bookId: v.id("books"),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Get current user
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      return {
        success: false,
        error: "Must be authenticated to revoke approval",
      };
    }

    // Find the latest approval
    const approvals = await ctx.db
      .query("cleanupApprovals")
      .withIndex("by_book_id", q => q.eq("bookId", args.bookId))
      .order("desc")
      .take(1);

    const latestApproval = approvals[0];

    if (!latestApproval) {
      return {
        success: false,
        error: "No active approval found for this book",
      };
    }

    // Revoke by updating book status back to cleaned
    await ctx.db.patch(args.bookId, { status: "cleaned" });

    return {
      success: true,
    };
  },
});
