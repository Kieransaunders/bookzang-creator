/**
 * Public cleanup API surface
 *
 * Queries and mutations for starting cleanup, retrieving review data,
 * and managing the cleanup pipeline.
 */

import { v, type GenericId as Id } from "convex/values";
import {
  query,
  mutation,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { runDeterministicCleanup } from "./cleanupPipeline";
import { detectChapterBoundaries } from "./cleanupChaptering";
import {
  deterministicCleanupStageValidator,
  mapDeterministicCleanupStageToMainJobStage,
} from "./jobStages";

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

    if (book.copyrightStatus === "blocked") {
      throw new Error(
        "Cleanup is blocked for this title because copyright scan marked it as in-copyright.",
      );
    }

    // Check for existing cleanup job
    const existingJob = await ctx.db
      .query("cleanupJobs")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
      .filter((q) => q.eq(q.field("status"), "running"))
      .first();

    if (existingJob) {
      throw new Error(`Cleanup already in progress for book ${args.bookId}`);
    }

    // Create cleanup job
    const cleanupJobId = await ctx.db.insert("cleanupJobs", {
      bookId: args.bookId,
      stage: "queued",
      status: "queued",
      progress: 0,
      flagsCreated: 0,
      queuedAt: Date.now(),
    });

    // Also create a job in the main jobs table for unified tracking
    const mainJobId = await ctx.db.insert("jobs", {
      type: "clean",
      status: "queued",
      bookId: args.bookId,
      stage: "queued",
      progress: 0,
      queuedAt: Date.now(),
    });

    // Start the cleanup pipeline (async)
    await ctx.scheduler.runAfter(0, internal.cleanup.runCleanupPipeline, {
      bookId: args.bookId,
      fileId: book.fileId,
      jobId: cleanupJobId,
      mainJobId,
      preserveArchaic: args.preserveArchaic ?? true,
    });

    return { jobId: cleanupJobId, status: "queued" };
  },
});

/**
 * Internal action to run the full cleanup pipeline
 * Stores all content in File Storage to avoid 1MB document limit
 */
export const runCleanupPipeline: ReturnType<typeof internalAction> =
  internalAction({
    args: {
      bookId: v.id("books"),
      fileId: v.id("_storage"),
      jobId: v.id("cleanupJobs"),
      mainJobId: v.optional(v.id("jobs")),
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
          mainJobId: args.mainJobId,
          stage: "loading_original",
          progress: 10,
        });

        // Load the file content
        const blob = await ctx.storage.get(args.fileId);
        if (!blob) {
          throw new Error(`File ${args.fileId} not found in storage`);
        }

        const originalContent = await blob.text();
        const originalSizeBytes = new Blob([originalContent]).size;

        // Store original reference with size tracking
        await ctx.runMutation(internal.cleanup.insertOriginal, {
          bookId: args.bookId,
          fileId: args.fileId,
          sourceFormat: "gutenberg_txt",
          sizeBytes: originalSizeBytes,
        });

        // Run deterministic cleanup
        await ctx.runMutation(internal.cleanup.updateJobStage, {
          jobId: args.jobId,
          mainJobId: args.mainJobId,
          stage: "boilerplate_removal",
          progress: 30,
        });

        const cleanupResult = runDeterministicCleanup(originalContent, {
          preserveArchaic: args.preserveArchaic,
          unwrapParagraphs: true,
          normalizePunctuation: true,
        });

        // Store cleaned content as a file (not in database - 1MB limit)
        await ctx.runMutation(internal.cleanup.updateJobStage, {
          jobId: args.jobId,
          mainJobId: args.mainJobId,
          stage: "punctuation_normalization",
          progress: 50,
        });

        const cleanedBlob = new Blob([cleanupResult.content], {
          type: "text/plain",
        });
        const cleanedFileId = await ctx.storage.store(cleanedBlob);
        const cleanedSizeBytes = cleanedBlob.size;

        const revisionId = await ctx.runMutation(
          internal.cleanupPipeline.createCleanupRevision,
          {
            bookId: args.bookId,
            revisionNumber: 1,
            fileId: cleanedFileId,
            isDeterministic: true,
            isAiAssisted: false,
            preserveArchaic: args.preserveArchaic,
            createdBy: "system",
            sizeBytes: cleanedSizeBytes,
          },
        );

        // Detect and create chapters
        await ctx.runMutation(internal.cleanup.updateJobStage, {
          jobId: args.jobId,
          mainJobId: args.mainJobId,
          stage: "chapter_detection",
          progress: 70,
        });

        const chapterResult = detectChapterBoundaries(cleanupResult.content);

        // Store each chapter content as a separate file
        const chaptersForDb = [];
        for (const ch of chapterResult.chapters) {
          const chapterBlob = new Blob([ch.content], { type: "text/plain" });
          const chapterFileId = await ctx.storage.store(chapterBlob);

          chaptersForDb.push({
            chapterNumber: ch.chapterNumber,
            title: ch.title,
            type: ch.type,
            fileId: chapterFileId,
            startOffset: ch.startOffset,
            endOffset: ch.endOffset,
            detectedHeading: ch.detectedHeading ?? undefined,
            isUserConfirmed: ch.isUserConfirmed,
            confidence: ch.confidence,
            isOcrCorrupted: ch.isOcrCorrupted,
            sizeBytes: chapterBlob.size,
          });
        }

        const chapterIds = await ctx.runMutation(
          internal.cleanupPipeline.createChapterRecords,
          {
            bookId: args.bookId,
            revisionId,
            chapters: chaptersForDb,
          },
        );

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
          mainJobId: args.mainJobId,
          stage: "completed",
          progress: 90,
        });

        const flagIds = await ctx.runMutation(
          internal.cleanupFlags.batchCreateFlagsFromResults,
          {
            bookId: args.bookId,
            revisionId,
            unlabeledBreaks: cleanupResult.unlabeledBreaks,
            ambiguousPositions: cleanupResult.ambiguousPositions,
            lowConfidencePunctuation: cleanupResult.lowConfidencePunctuation,
            startMarkerFound: cleanupResult.startMarkerFound,
            endMarkerFound: cleanupResult.endMarkerFound,
          },
        );

        // Update job to completed
        await ctx.runMutation(internal.cleanup.completeJob, {
          jobId: args.jobId,
          mainJobId: args.mainJobId,
          revisionId,
          chaptersDetected: chapterResult.chapters.length,
          flagsCreated:
            flagIds.length +
            chapterResult.chapters.filter((c) => c.isOcrCorrupted).length,
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
          mainJobId: args.mainJobId,
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

    // Get latest revisions (multiple to avoid selecting placeholder rows)
    const revisions = await ctx.db
      .query("cleanupRevisions")
      .withIndex("by_book_id_revision", (q) => q.eq("bookId", args.bookId))
      .order("desc")
      .take(10);

    let latestRevision = null;
    for (const revision of revisions) {
      const hasLegacyContent = revision.content !== undefined;
      const hasUsableStoredFile =
        revision.fileId !== undefined && (revision.sizeBytes ?? 0) > 0;

      if (hasLegacyContent || hasUsableStoredFile) {
        const contentUrl = revision.fileId
          ? await ctx.storage.getUrl(revision.fileId)
          : null;
        latestRevision = {
          ...revision,
          contentUrl,
        };
        break;
      }
    }

    if (!latestRevision && revisions[0]) {
      latestRevision = { ...revisions[0], content: "" };
    }

    // Get chapters for latest revision
    const chapters = latestRevision
      ? await ctx.db
          .query("cleanupChapters")
          .withIndex("by_revision_id", (q) =>
            q.eq("revisionId", latestRevision._id),
          )
          .order("asc")
          .collect()
      : [];

    // Get unresolved flags
    const flags = latestRevision
      ? await ctx.db
          .query("cleanupFlags")
          .withIndex("by_book_status", (q) =>
            q.eq("bookId", args.bookId).eq("status", "unresolved"),
          )
          .collect()
      : [];

    // Get original content (prefer newest record with usable content)
    const originals = await ctx.db
      .query("cleanupOriginals")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
      .collect();

    const originalCandidates = [...originals].sort(
      (a, b) => (b.capturedAt ?? 0) - (a.capturedAt ?? 0),
    );

    let original = null;
    for (const candidate of originalCandidates) {
      const hasLegacyContent = candidate.content !== undefined;
      const hasStoredFile = candidate.fileId !== undefined;
      if (hasLegacyContent || hasStoredFile) {
        const contentUrl = candidate.fileId
          ? await ctx.storage.getUrl(candidate.fileId)
          : null;
        original = { ...candidate, contentUrl };
        break;
      }
    }

    // Fallback for legacy cleanupOriginals rows that have no content/fileId
    if (!original && book.fileId) {
      const contentUrl = await ctx.storage.getUrl(book.fileId);
      if (contentUrl) {
        original = {
          ...originalCandidates[0],
          fileId: book.fileId,
          contentUrl,
        };
      }
    }

    return {
      book,
      original,
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
    status: v.optional(
      v.union(
        v.literal("unresolved"),
        v.literal("confirmed"),
        v.literal("rejected"),
        v.literal("overridden"),
      ),
    ),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let query_ = ctx.db
      .query("cleanupFlags")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId));

    if (args.status) {
      query_ = query_.filter((q) => q.eq(q.field("status"), args.status));
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
    status: v.union(
      v.literal("confirmed"),
      v.literal("rejected"),
      v.literal("overridden"),
    ),
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
    const userRecord = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", user.email))
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
    const chapters = await ctx.db
      .query("cleanupChapters")
      .withIndex("by_revision_id", (q) => q.eq("revisionId", flag.revisionId))
      .collect();

    const maxChapter = chapters.reduce(
      (max, ch) => Math.max(max, ch.chapterNumber),
      0,
    );

    // Schedule action since mutations can't call actions directly
    await ctx.scheduler.runAfter(
      0,
      internal.cleanupFlags.promoteBoundaryToChapter,
      {
        bookId: flag.bookId,
        revisionId: flag.revisionId,
        flagId: args.flagId,
        title: args.title,
        type: args.type,
        chapterNumber: maxChapter + 1,
      },
    );

    // Return placeholder - actual chapter will be created async
    return { chapterId: "xxx" as unknown as Id<"cleanupChapters"> };
  },
});

/**
 * Internal action to save a revision with file storage
 * This runs as an action to avoid 1MB mutation size limit
 */
export const saveRevisionWithFiles: ReturnType<typeof internalAction> =
  internalAction({
    args: {
      bookId: v.id("books"),
      content: v.string(),
      revisionNumber: v.number(),
      isDeterministic: v.boolean(),
      isAiAssisted: v.boolean(),
      preserveArchaic: v.boolean(),
      parentRevisionId: v.optional(v.id("cleanupRevisions")),
      userId: v.id("users"),
      approvalKept: v.boolean(),
      latestApprovalId: v.optional(v.id("cleanupApprovals")),
    },
    returns: v.object({
      revisionId: v.id("cleanupRevisions"),
      chapterIds: v.array(v.id("cleanupChapters")),
    }),
    handler: async (
      ctx,
      args,
    ): Promise<{
      revisionId: Id<"cleanupRevisions">;
      chapterIds: Id<"cleanupChapters">[];
    }> => {
      // Store cleaned content as a file (not in database - 1MB limit)
      const contentBlob = new Blob([args.content], { type: "text/plain" });
      const contentFileId = await ctx.storage.store(contentBlob);

      // Detect chapters for the new content
      const chapterResult = detectChapterBoundaries(args.content);

      // Store each chapter as a file and collect metadata
      const chapterFiles: Array<{
        chapterNumber: number;
        title: string;
        type:
          | "chapter"
          | "preface"
          | "introduction"
          | "notes"
          | "appendix"
          | "body";
        fileId: Id<"_storage">;
        startOffset: number;
        endOffset: number;
        detectedHeading?: string;
        isUserConfirmed: boolean;
        confidence: "high" | "medium" | "low";
        isOcrCorrupted: boolean;
        sizeBytes: number;
      }> = [];
      for (const ch of chapterResult.chapters) {
        const chapterBlob = new Blob([ch.content], { type: "text/plain" });
        const chapterFileId = await ctx.storage.store(chapterBlob);

        chapterFiles.push({
          chapterNumber: ch.chapterNumber,
          title: ch.title,
          type: ch.type,
          fileId: chapterFileId,
          startOffset: ch.startOffset,
          endOffset: ch.endOffset,
          detectedHeading: ch.detectedHeading ?? undefined,
          isUserConfirmed: ch.isUserConfirmed,
          confidence: ch.confidence,
          isOcrCorrupted: ch.isOcrCorrupted,
          sizeBytes: chapterBlob.size,
        });
      }

      // Create revision record with file reference
      const revisionId: Id<"cleanupRevisions"> = await ctx.runMutation(
        internal.cleanup.createRevisionRecord,
        {
          bookId: args.bookId,
          revisionNumber: args.revisionNumber,
          fileId: contentFileId,
          sizeBytes: contentBlob.size,
          isDeterministic: args.isDeterministic,
          isAiAssisted: args.isAiAssisted,
          preserveArchaic: args.preserveArchaic,
          createdBy: "user",
          parentRevisionId: args.parentRevisionId,
        },
      );

      // Create chapter records with file references
      const chapterIds: Id<"cleanupChapters">[] = await ctx.runMutation(
        internal.cleanupPipeline.createChapterRecords,
        {
          bookId: args.bookId,
          revisionId,
          chapters: chapterFiles,
        },
      );

      // If keeping approval, create approval record
      if (args.approvalKept && args.latestApprovalId) {
        const approval = await ctx.runQuery(
          internal.cleanup.getApprovalChecklist,
          {
            approvalId: args.latestApprovalId,
          },
        );
        if (approval.checklistConfirmed) {
          await ctx.runMutation(internal.cleanup.createApprovalForRevision, {
            bookId: args.bookId,
            revisionId,
            userId: args.userId,
            checklistConfirmed: approval.checklistConfirmed,
          });
        }
      }

      return { revisionId, chapterIds };
    },
  });

/**
 * Internal mutation to create a revision record with file reference
 */
export const createRevisionRecord = internalMutation({
  args: {
    bookId: v.id("books"),
    revisionNumber: v.number(),
    fileId: v.id("_storage"),
    sizeBytes: v.number(),
    isDeterministic: v.boolean(),
    isAiAssisted: v.boolean(),
    preserveArchaic: v.boolean(),
    createdBy: v.union(v.literal("system"), v.literal("ai"), v.literal("user")),
    parentRevisionId: v.optional(v.id("cleanupRevisions")),
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
      createdBy: args.createdBy,
      parentRevisionId: args.parentRevisionId,
    });
  },
});

/**
 * Internal query to get approval checklist
 */
export const getApprovalChecklist = internalQuery({
  args: {
    approvalId: v.id("cleanupApprovals"),
  },
  returns: v.object({
    checklistConfirmed: v.optional(
      v.object({
        boilerplateRemoved: v.boolean(),
        chapterBoundariesVerified: v.boolean(),
        punctuationReviewed: v.boolean(),
        archaicPreserved: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const approval = await ctx.db.get(args.approvalId);
    if (!approval) return { checklistConfirmed: undefined };
    return { checklistConfirmed: approval.checklistConfirmed };
  },
});

/**
 * Internal mutation to create an approval record for a revision
 */
export const createApprovalForRevision = internalMutation({
  args: {
    bookId: v.id("books"),
    revisionId: v.id("cleanupRevisions"),
    userId: v.id("users"),
    checklistConfirmed: v.object({
      boilerplateRemoved: v.boolean(),
      chapterBoundariesVerified: v.boolean(),
      punctuationReviewed: v.boolean(),
      archaicPreserved: v.boolean(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("cleanupApprovals", {
      bookId: args.bookId,
      revisionId: args.revisionId,
      approvedBy: args.userId,
      approvedAt: Date.now(),
      checklistConfirmed: args.checklistConfirmed,
    });

    // Update book status to ready
    await ctx.db.patch(args.bookId, { status: "ready" });

    return null;
  },
});

/**
 * Save a new cleaned revision from reviewer edits
 * Creates a new revision with user as the creator
 * Stores content in File Storage to avoid 1MB limit
 * 
 * POST-APPROVAL EDIT HANDLING:
 * If the book has an active approval and keepApproval is not specified,
   the caller must prompt for keep/revoke choice. If keepApproval is true,
 * the new revision becomes the approved revision. If keepApproval is false
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

    const userRecord = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", user.email))
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
    const latestRevisions = await ctx.db
      .query("cleanupRevisions")
      .withIndex("by_book_id_revision", (q) => q.eq("bookId", args.bookId))
      .order("desc")
      .take(1);

    const latestRevision = latestRevisions[0];
    const newRevisionNumber = latestRevision
      ? latestRevision.revisionNumber + 1
      : 1;

    // Inherit properties from parent revision if available
    const isDeterministic = latestRevision?.isDeterministic ?? false;
    const isAiAssisted = latestRevision?.isAiAssisted ?? false;
    const preserveArchaic = latestRevision?.preserveArchaic ?? true;

    // Check if there's an active approval
    const approvals = await ctx.db
      .query("cleanupApprovals")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
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

    // Schedule an action to store the revision and chapters in file storage
    // This avoids the 1MB mutation size limit
    await ctx.scheduler.runAfter(0, internal.cleanup.saveRevisionWithFiles, {
      bookId: args.bookId,
      content: args.content,
      revisionNumber: newRevisionNumber,
      isDeterministic,
      isAiAssisted,
      preserveArchaic,
      parentRevisionId: args.parentRevisionId ?? latestRevision?._id,
      userId: userRecord._id,
      approvalKept,
      latestApprovalId: latestApproval?._id,
    });

    // Return optimistic response while async action creates the real revision.
    // Do not insert placeholder rows with fake file IDs; schema requires valid
    // storage IDs whenever fileId is present.
    const optimisticRevisionId =
      args.parentRevisionId ??
      latestRevision?._id ??
      (() => {
        throw new Error(
          "No base revision available for optimistic save response",
        );
      })();

    return {
      revisionId: optimisticRevisionId,
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
    const jobs = await ctx.db
      .query("cleanupJobs")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
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
  returns: v.array(
    v.union(
      v.null(),
      v.object({
        bookId: v.string(),
        status: v.union(
          v.literal("queued"),
          v.literal("running"),
          v.literal("completed"),
          v.literal("failed"),
        ),
        stage: v.optional(v.string()),
        progress: v.optional(v.number()),
        error: v.optional(v.string()),
      }),
    ),
  ),
  handler: async (ctx, args) => {
    const results = [];

    for (const bookId of args.bookIds) {
      const job = await ctx.db
        .query("cleanupJobs")
        .withIndex("by_book_id", (q) => q.eq("bookId", bookId))
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
 * Stores reference to file in storage, not content (1MB limit)
 */
export const insertOriginal = internalMutation({
  args: {
    bookId: v.id("books"),
    fileId: v.id("_storage"),
    sourceFormat: v.union(v.literal("gutenberg_txt"), v.literal("markdown")),
    sizeBytes: v.number(),
  },
  returns: v.id("cleanupOriginals"),
  handler: async (ctx, args) => {
    // Check if original already exists
    const existing = await ctx.db
      .query("cleanupOriginals")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("cleanupOriginals", {
      bookId: args.bookId,
      fileId: args.fileId,
      capturedAt: Date.now(),
      sourceFormat: args.sourceFormat,
      sizeBytes: args.sizeBytes,
    });
  },
});

/**
 * Update job stage
 */
export const updateJobStage = internalMutation({
  args: {
    jobId: v.id("cleanupJobs"),
    mainJobId: v.optional(v.id("jobs")),
    stage: deterministicCleanupStageValidator,
    progress: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const mainJobStage = mapDeterministicCleanupStageToMainJobStage(args.stage);

    const update: Record<string, unknown> = {
      stage: args.stage,
      progress: args.progress,
    };

    const job = await ctx.db.get(args.jobId);
    if (!job) return null;

    if (args.stage === "loading_original" && !job.startedAt) {
      update.startedAt = Date.now();
      update.status = "running";
    }

    await ctx.db.patch(args.jobId, update);

    // Also update the corresponding main job if provided
    if (args.mainJobId) {
      const mainJob = await ctx.db.get(args.mainJobId);
      if (mainJob) {
        const mainUpdate: Record<string, unknown> = {
          stage: mainJobStage,
          progress: args.progress,
        };
        if (args.stage === "loading_original" && !mainJob.startedAt) {
          mainUpdate.startedAt = Date.now();
          mainUpdate.status = "running";
        }
        await ctx.db.patch(args.mainJobId, mainUpdate);
      }
    }

    return null;
  },
});

/**
 * Complete cleanup job
 */
export const completeJob = internalMutation({
  args: {
    jobId: v.id("cleanupJobs"),
    mainJobId: v.optional(v.id("jobs")),
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

    // Also update the corresponding main job if provided
    if (args.mainJobId) {
      await ctx.db.patch(args.mainJobId, {
        status: "completed",
        stage: "completed",
        progress: 100,
        completedAt: Date.now(),
      });
    }

    return null;
  },
});

/**
 * Fail cleanup job
 */
export const failJob = internalMutation({
  args: {
    jobId: v.id("cleanupJobs"),
    mainJobId: v.optional(v.id("jobs")),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "failed",
      error: args.error,
    });

    // Also update the corresponding main job if provided
    if (args.mainJobId) {
      await ctx.db.patch(args.mainJobId, {
        status: "failed",
        error: args.error,
        failedAt: Date.now(),
      });
    }

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
      .withIndex("by_book_id_revision", (q) => q.eq("bookId", args.bookId))
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
      .withIndex("by_book_status", (q) =>
        q.eq("bookId", args.bookId).eq("status", "unresolved"),
      )
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
    const allConfirmed =
      checklist.boilerplateRemoved &&
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
      .withIndex("by_book_status", (q) =>
        q.eq("bookId", args.bookId).eq("status", "unresolved"),
      )
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

    const userRecord = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", user.email))
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
      .withIndex("by_book_id_revision", (q) => q.eq("bookId", args.bookId))
      .order("desc")
      .take(1);

    const latestRevision = revisions[0];

    // Get latest approval
    const approvals = await ctx.db
      .query("cleanupApprovals")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
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
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
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

// ─── DEV UTILITIES ─────────────────────────────────────────────────────────

/**
 * DEV ONLY: Clear all cleanup data for a book (useful when schema changes)
 */
export const clearCleanupData = internalMutation({
  args: {
    bookId: v.id("books"),
  },
  returns: v.object({
    originalsDeleted: v.number(),
    revisionsDeleted: v.number(),
    chaptersDeleted: v.number(),
    flagsDeleted: v.number(),
    jobsDeleted: v.number(),
  }),
  handler: async (ctx, args) => {
    // Delete originals
    const originals = await ctx.db
      .query("cleanupOriginals")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
      .collect();
    for (const orig of originals) {
      await ctx.db.delete(orig._id);
    }

    // Delete revisions (this will orphan chapters, but we'll clean them too)
    const revisions = await ctx.db
      .query("cleanupRevisions")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
      .collect();
    for (const rev of revisions) {
      await ctx.db.delete(rev._id);
    }

    // Delete chapters
    const chapters = await ctx.db
      .query("cleanupChapters")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
      .collect();
    for (const ch of chapters) {
      await ctx.db.delete(ch._id);
    }

    // Delete flags
    const flags = await ctx.db
      .query("cleanupFlags")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
      .collect();
    for (const flag of flags) {
      await ctx.db.delete(flag._id);
    }

    // Delete jobs
    const jobs = await ctx.db
      .query("cleanupJobs")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
      .collect();
    for (const job of jobs) {
      await ctx.db.delete(job._id);
    }

    // Reset book status to imported
    await ctx.db.patch(args.bookId, { status: "imported" });

    return {
      originalsDeleted: originals.length,
      revisionsDeleted: revisions.length,
      chaptersDeleted: chapters.length,
      flagsDeleted: flags.length,
      jobsDeleted: jobs.length,
    };
  },
});
