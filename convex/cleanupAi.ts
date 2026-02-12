/**
 * AI-Assisted Cleanup Pipeline
 * 
 * Internal actions for running AI cleanup passes on book text.
 * Orchestrates the flow: deterministic baseline -> AI patch proposals -> 
 * validated revision write -> unresolved low-confidence flags.
 * 
 * This implements CLEAN-03 from the phase plan.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, query, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { createCleanupAiClient } from "./cleanupAiClient";
import { buildSegmentPrompt, validateCleanupResponse, type CleanupPatch } from "./cleanupPrompts";

/**
 * Configuration for AI cleanup batch processing
 */
const AI_CLEANUP_CONFIG = {
  // Maximum characters to send in a single AI request
  // Keeping this conservative to stay within token limits
  MAX_SEGMENT_SIZE: 8000,
  // Overlap between segments for continuity
  SEGMENT_OVERLAP: 200,
  // Delay between API calls to avoid rate limits
  RATE_LIMIT_DELAY_MS: 500,
};

/**
 * Internal action to run AI cleanup pass on a book
 * 
 * This is the main entry point for AI-assisted cleanup.
 * It takes the latest deterministic revision and produces a new AI-assisted revision.
 * 
 * Flow:
 * 1. Get latest revision for book
 * 2. Split content into segments
 * 3. Request cleanup patches from AI for each segment
 * 4. Validate and collate all patches
 * 5. Apply patches to create new revision
 * 6. Create flags for low-confidence patches
 */
export const runCleanupAiPass: ReturnType<typeof internalAction> = internalAction({
  args: {
    bookId: v.id("books"),
    revisionId: v.id("cleanupRevisions"),
    jobId: v.optional(v.id("cleanupJobs")),
  },
  returns: v.object({
    success: v.boolean(),
    newRevisionId: v.optional(v.id("cleanupRevisions")),
    patchesApplied: v.optional(v.number()),
    lowConfidenceFlags: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      // Update job status if provided
      if (args.jobId) {
        await ctx.runMutation(internal.cleanupAi.updateJobAiStage, {
          jobId: args.jobId,
          stage: "ai_analysis",
          progress: 10,
        });
      }

      // Get the revision to process via query
      const revision = await ctx.runQuery(internal.cleanupAi.getRevisionForAi, {
        revisionId: args.revisionId,
      });
      
      if (!revision) {
        throw new Error(`Revision ${args.revisionId} not found`);
      }

      // Don't run AI on already AI-assisted revisions (prevent double-processing)
      if (revision.isAiAssisted) {
        throw new Error("Revision is already AI-assisted; create new deterministic revision first");
      }

      // Get chapters for context
      const chapters = await ctx.runQuery(internal.cleanupAi.getChaptersForAi, {
        revisionId: args.revisionId,
      });

      // Create AI client
      const aiClient = createCleanupAiClient();

      if (!aiClient.isConfigured()) {
        console.log("AI client not configured, skipping AI cleanup pass");
        // Return success but indicate no processing occurred
        return {
          success: true,
          patchesApplied: 0,
          lowConfidenceFlags: 0,
          error: "AI client not configured (KIMI_API_KEY not set)",
        };
      }

      // Split content into segments
      const segments = splitIntoSegments(revision.content, AI_CLEANUP_CONFIG.MAX_SEGMENT_SIZE);
      console.log(`Processing ${segments.length} segments for book ${args.bookId}`);

      if (args.jobId) {
        await ctx.runMutation(internal.cleanupAi.updateJobAiStage, {
          jobId: args.jobId,
          stage: "ai_processing",
          progress: 20,
        });
      }

      // Process each segment
      const allPatches: CleanupPatch[] = [];
      const segmentSummaries: string[] = [];

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const progress = 20 + Math.floor((i / segments.length) * 60);

        if (args.jobId) {
          await ctx.runMutation(internal.cleanupAi.updateJobAiStage, {
            jobId: args.jobId,
            stage: "ai_processing",
            progress,
          });
        }

        // Find which chapter this segment belongs to
        const chapterContext = findChapterForPosition(chapters, segment.startOffset);

        try {
          // Request cleanup from AI
          const aiResponse = await aiClient.requestCleanupPatches(segment.text, {
            chapterTitle: chapterContext?.title,
            previousContext: i > 0 ? segments[i - 1].text : undefined,
            nextContext: i < segments.length - 1 ? segments[i + 1].text : undefined,
          });

          // Adjust patch offsets to be relative to full document
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const adjustedPatches = aiResponse.patches.map((patch: any) => ({
            start: patch.start + segment.startOffset,
            end: patch.end + segment.startOffset,
            original: patch.original,
            replacement: patch.replacement,
            confidence: patch.confidence,
            reason: patch.reason,
            category: patch.category,
          }));

          allPatches.push(...adjustedPatches);
          segmentSummaries.push(aiResponse.summary);

          console.log(`Segment ${i + 1}: ${adjustedPatches.length} patches (${aiResponse.patches.filter(p => p.confidence === "low").length} low confidence)`);

          // Rate limiting delay
          if (i < segments.length - 1) {
            await sleep(AI_CLEANUP_CONFIG.RATE_LIMIT_DELAY_MS);
          }
        } catch (error) {
          console.error(`Error processing segment ${i + 1}:`, error);
          // Continue with other segments rather than failing entirely
          segmentSummaries.push(`Segment ${i + 1}: Error - ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (args.jobId) {
        await ctx.runMutation(internal.cleanupAi.updateJobAiStage, {
          jobId: args.jobId,
          stage: "applying_patches",
          progress: 80,
        });
      }

      // Validate all patches against full text
      const validatedResponse = validateCleanupResponse(
        {
          patches: allPatches,
          summary: segmentSummaries.join("; "),
          preservationNotes: [],
          stats: {
            highConfidencePatches: allPatches.filter(p => p.confidence === "high").length,
            lowConfidencePatches: allPatches.filter(p => p.confidence === "low").length,
            ocrErrorsFixed: allPatches.filter(p => p.category === "ocr_error").length,
            punctuationNormalizations: allPatches.filter(p => p.category === "punctuation_normalization").length,
          },
        },
        revision.content
      );

      if (!validatedResponse.success) {
        throw new Error(`Patch validation failed: ${validatedResponse.error}`);
      }

      // Apply patches and create new revision
      const result = await ctx.runMutation(internal.cleanupPatchApply.applyPatchesAndCreateRevision, {
        bookId: args.bookId,
        parentRevisionId: args.revisionId,
        patches: validatedResponse.data.patches,
        summary: validatedResponse.data.summary,
        preservationNotes: validatedResponse.data.preservationNotes,
      });

      if (args.jobId) {
        await ctx.runMutation(internal.cleanupAi.completeAiJob, {
          jobId: args.jobId,
          newRevisionId: result.newRevisionId,
          patchesApplied: result.patchesApplied,
          flagsCreated: result.flagsCreated,
        });
      }

      return {
        success: true,
        newRevisionId: result.newRevisionId,
        patchesApplied: result.patchesApplied,
        lowConfidenceFlags: result.flagsCreated,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("AI cleanup pass failed:", errorMessage);

      if (args.jobId) {
        await ctx.runMutation(internal.cleanupAi.failAiJob, {
          jobId: args.jobId,
          error: errorMessage,
        });
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});

/**
 * Start AI cleanup for a book (internal mutation)
 * Creates a job and schedules the AI action
 */
export const startAiCleanup: ReturnType<typeof internalMutation> = internalMutation({
  args: {
    bookId: v.id("books"),
    revisionId: v.id("cleanupRevisions"),
  },
  returns: v.object({
    jobId: v.id("cleanupJobs"),
  }),
  handler: async (ctx, args) => {
    // Create cleanup job
    const jobId = await ctx.db.insert("cleanupJobs", {
      bookId: args.bookId,
      stage: "queued",
      status: "queued",
      progress: 0,
      flagsCreated: 0,
      queuedAt: Date.now(),
    });

    // Schedule AI pass
    await ctx.scheduler.runAfter(0, internal.cleanupAi.runCleanupAiPass, {
      bookId: args.bookId,
      revisionId: args.revisionId,
      jobId,
    });

    return { jobId };
  },
});

/**
 * Split text into overlapping segments for AI processing
 */
function splitIntoSegments(text: string, maxSize: number): Array<{ text: string; startOffset: number }> {
  const segments: Array<{ text: string; startOffset: number }> = [];

  // If text is small enough, process as single segment
  if (text.length <= maxSize) {
    return [{ text, startOffset: 0 }];
  }

  let currentPos = 0;

  while (currentPos < text.length) {
    // Find the end of this segment
    let endPos = Math.min(currentPos + maxSize, text.length);

    // Try to break at paragraph boundary
    if (endPos < text.length) {
      const paragraphBreak = text.lastIndexOf("\n\n", endPos);
      if (paragraphBreak > currentPos + maxSize / 2) {
        endPos = paragraphBreak + 2; // Include the newlines
      } else {
        // Try line break
        const lineBreak = text.lastIndexOf("\n", endPos);
        if (lineBreak > currentPos + maxSize / 2) {
          endPos = lineBreak + 1;
        } else {
          // Try space
          const spaceBreak = text.lastIndexOf(" ", endPos);
          if (spaceBreak > currentPos + maxSize / 2) {
            endPos = spaceBreak + 1;
          }
        }
      }
    }

    segments.push({
      text: text.slice(currentPos, endPos),
      startOffset: currentPos,
    });

    // Move to next segment with overlap
    currentPos = endPos - AI_CLEANUP_CONFIG.SEGMENT_OVERLAP;
    if (currentPos >= text.length) break;
  }

  return segments;
}

/**
 * Find which chapter contains a given text position
 */
function findChapterForPosition(
  chapters: Array<{
    chapterNumber: number;
    title: string;
    startOffset: number;
    endOffset: number;
  }>,
  position: number
): { chapterNumber: number; title: string } | undefined {
  for (const chapter of chapters) {
    if (position >= chapter.startOffset && position < chapter.endOffset) {
      return {
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
      };
    }
  }
  return undefined;
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// Job Management Mutations
// =============================================================================

/**
 * Update job AI stage
 */
export const updateJobAiStage: ReturnType<typeof internalMutation> = internalMutation({
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
    segmentInfo: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const update: Record<string, unknown> = {
      stage: args.stage,
      progress: args.progress,
    };

    if (args.segmentInfo) {
      update.segmentInfo = args.segmentInfo;
    }

    if (args.stage !== "queued") {
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
 * Complete AI cleanup job
 */
export const completeAiJob: ReturnType<typeof internalMutation> = internalMutation({
  args: {
    jobId: v.id("cleanupJobs"),
    newRevisionId: v.id("cleanupRevisions"),
    patchesApplied: v.number(),
    flagsCreated: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "completed",
      stage: "completed",
      revisionId: args.newRevisionId,
      flagsCreated: args.flagsCreated,
      progress: 100,
      completedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Fail AI cleanup job
 */
export const failAiJob: ReturnType<typeof internalMutation> = internalMutation({
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

// =============================================================================
// Internal Queries
// =============================================================================

/**
 * Get revision for processing
 */
export const getRevisionForAi: ReturnType<typeof internalQuery> = internalQuery({
  args: {
    revisionId: v.id("cleanupRevisions"),
  },
  returns: v.union(v.null(), v.object({
    _id: v.id("cleanupRevisions"),
    bookId: v.id("books"),
    revisionNumber: v.number(),
    content: v.string(),
    isAiAssisted: v.boolean(),
  })),
  handler: async (ctx, args) => {
    const revision = await ctx.db.get(args.revisionId);
    if (!revision) return null;
    return {
      _id: revision._id,
      bookId: revision.bookId,
      revisionNumber: revision.revisionNumber,
      content: revision.content,
      isAiAssisted: revision.isAiAssisted,
    };
  },
});

/**
 * Get chapters for revision
 */
export const getChaptersForAi: ReturnType<typeof internalQuery> = internalQuery({
  args: {
    revisionId: v.id("cleanupRevisions"),
  },
  returns: v.array(v.object({
    chapterNumber: v.number(),
    title: v.string(),
    startOffset: v.number(),
    endOffset: v.number(),
  })),
  handler: async (ctx, args) => {
    const chapters = await ctx.db
      .query("cleanupChapters")
      .withIndex("by_revision_id", (q) => q.eq("revisionId", args.revisionId))
      .order("asc")
      .collect();

    return chapters.map(ch => ({
      chapterNumber: ch.chapterNumber,
      title: ch.title,
      startOffset: ch.startOffset,
      endOffset: ch.endOffset,
    }));
  },
});

// =============================================================================
// Public Queries
// =============================================================================

/**
 * Get AI cleanup status for a book
 */
export const getAiCleanupStatus = query({
  args: {
    bookId: v.id("books"),
  },
  returns: v.union(v.null(), v.object({
    job: v.any(),
    latestRevision: v.any(),
    canRunAi: v.boolean(),
  })),
  handler: async (ctx, args) => {
    // Get latest AI-related job
    const jobs = await ctx.db
      .query("cleanupJobs")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
      .order("desc")
      .take(5);

    const aiJob = jobs[0];

    // Get latest revision
    const revisions = await ctx.db
      .query("cleanupRevisions")
      .withIndex("by_book_id_revision", (q) => q.eq("bookId", args.bookId))
      .order("desc")
      .take(1);

    const latestRevision = revisions[0];

    // Can run AI if latest revision exists and is not already AI-assisted
    const canRunAi = latestRevision ? !latestRevision.isAiAssisted : false;

    return {
      job: aiJob || null,
      latestRevision: latestRevision || null,
      canRunAi,
    };
  },
});

/**
 * Get all AI patches for a revision (for review/debugging)
 */
export const getAiPatchesForRevision = query({
  args: {
    revisionId: v.id("cleanupRevisions"),
  },
  returns: v.object({
    revision: v.any(),
    parentRevision: v.any(),
    flags: v.array(v.any()),
  }),
  handler: async (ctx, args) => {
    const revision = await ctx.db.get(args.revisionId);
    if (!revision) {
      throw new Error(`Revision ${args.revisionId} not found`);
    }

    const parentRevision = revision.parentRevisionId
      ? await ctx.db.get(revision.parentRevisionId)
      : null;

    // Get flags that were created by AI
    const flags = await ctx.db
      .query("cleanupFlags")
      .withIndex("by_revision_id", (q) => q.eq("revisionId", args.revisionId))
      .collect();

    return {
      revision,
      parentRevision,
      flags,
    };
  },
});
