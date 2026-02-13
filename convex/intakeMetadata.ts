import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";

const START_MARKER =
  /\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i;
const END_MARKER =
  /\*\*\* END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i;

const extractLineValue = (text: string, key: "Title" | "Author") => {
  const match = text.match(new RegExp(`^${key}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim();
};

const parseMetadata = (text: string) => {
  const title = extractLineValue(text, "Title") ?? "Unknown Title";
  const author = extractLineValue(text, "Author") ?? "Unknown Author";

  const startMatch = START_MARKER.exec(text);
  const endMatch = END_MARKER.exec(text);

  const body =
    startMatch && endMatch && endMatch.index > startMatch.index
      ? text
          .slice(startMatch.index + startMatch[0].length, endMatch.index)
          .trim()
      : text.trim();

  return {
    title,
    author,
    bodyLength: body.length,
  };
};

export const extractAndPersist = internalAction({
  args: {
    jobId: v.id("jobs"),
    bookId: v.id("books"),
    fileId: v.optional(v.id("_storage")),
    source: v.union(v.literal("upload"), v.literal("discovery")),
    gutenbergId: v.optional(v.string()),
    sourcePath: v.optional(v.string()),
    candidateId: v.optional(v.id("discoveryCandidates")),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.intakeMetadata.markRunning, {
      jobId: args.jobId,
      candidateId: args.candidateId,
    });

    try {
      if (!args.fileId) {
        throw new Error("No uploaded file is linked to this intake job");
      }

      const blob = await ctx.storage.get(args.fileId);
      if (!blob) {
        throw new Error("Uploaded file could not be loaded from storage");
      }

      const text = await blob.text();
      if (!text.trim()) {
        throw new Error("Uploaded file is empty");
      }

      await ctx.runMutation(internal.intakeMetadata.markParsing, {
        jobId: args.jobId,
      });

      const parsed = parseMetadata(text);

      await ctx.runMutation(internal.intakeMetadata.markCompleted, {
        jobId: args.jobId,
        bookId: args.bookId,
        candidateId: args.candidateId,
        title: parsed.title,
        author: parsed.author,
        bodyLength: parsed.bodyLength,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown extraction error";
      const snippet = message.slice(0, 180);

      await ctx.runMutation(internal.intakeMetadata.markFailed, {
        jobId: args.jobId,
        bookId: args.bookId,
        candidateId: args.candidateId,
        error: snippet,
        errorDetails: message,
      });
    }
  },
});

export const markRunning = internalMutation({
  args: {
    jobId: v.id("jobs"),
    candidateId: v.optional(v.id("discoveryCandidates")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "running",
      stage: "loading_file",
      progress: 10,
      startedAt: Date.now(),
      logs: "Loading source text from storage",
      error: undefined,
      errorDetails: undefined,
    });

    if (args.candidateId) {
      await ctx.db.patch(args.candidateId, {
        status: "running",
        error: undefined,
      });
    }
  },
});

export const markParsing = internalMutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      stage: "parsing_metadata",
      progress: 60,
      logs: "Parsing Gutenberg metadata markers",
    });
  },
});

export const markCompleted = internalMutation({
  args: {
    jobId: v.id("jobs"),
    bookId: v.id("books"),
    candidateId: v.optional(v.id("discoveryCandidates")),
    title: v.string(),
    author: v.string(),
    bodyLength: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.bookId, {
      title: args.title,
      author: args.author,
      status: "imported",
      copyrightStatus: "checking",
      lastError: undefined,
    });

    await ctx.db.patch(args.jobId, {
      status: "completed",
      stage: "completed",
      progress: 100,
      completedAt: now,
      logs: `Metadata extracted successfully (${args.bodyLength} body chars)`,
      error: undefined,
      errorDetails: undefined,
    });

    if (args.candidateId) {
      await ctx.db.patch(args.candidateId, {
        status: "completed",
        error: undefined,
      });
    }

    // Schedule copyright research after successful import
    await ctx.scheduler.runAfter(0, internal.copyrightAi.researchCopyright, {
      bookId: args.bookId,
      triggerSource: "intake",
    });
  },
});

export const markFailed = internalMutation({
  args: {
    jobId: v.id("jobs"),
    bookId: v.id("books"),
    candidateId: v.optional(v.id("discoveryCandidates")),
    error: v.string(),
    errorDetails: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.jobId, {
      status: "failed",
      stage: "failed",
      progress: 100,
      failedAt: now,
      error: args.error,
      errorDetails: args.errorDetails,
      logs: "Metadata extraction failed",
    });

    await ctx.db.patch(args.bookId, {
      status: "failed",
      lastError: args.error,
    });

    if (args.candidateId) {
      await ctx.db.patch(args.candidateId, {
        status: "failed",
        error: args.error,
      });
    }
  },
});
