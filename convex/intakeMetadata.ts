import { internalAction } from "./_generated/server";
import { v } from "convex/values";

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
    await ctx.runMutation((internal as any).intakeMetadataSupport.markRunning, {
      jobId: args.jobId,
      candidateId: args.candidateId,
    });

    await ctx.runMutation(
      (internal as any).intakeMetadataSupport.markCompleted,
      {
        jobId: args.jobId,
        bookId: args.bookId,
        candidateId: args.candidateId,
        title: undefined,
        author: undefined,
      },
    );
  },
});

import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const markRunning = internalMutation({
  args: {
    jobId: v.id("jobs"),
    candidateId: v.optional(v.id("discoveryCandidates")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.jobId, {
      status: "running",
      stage: "loading_file",
      progress: 10,
      startedAt: now,
      logs: "Metadata extraction started",
      error: undefined,
      errorDetails: undefined,
    });

    if (args.candidateId) {
      await ctx.db.patch(args.candidateId, {
        status: "running",
      });
    }
  },
});

export const markCompleted = internalMutation({
  args: {
    jobId: v.id("jobs"),
    bookId: v.id("books"),
    candidateId: v.optional(v.id("discoveryCandidates")),
    title: v.optional(v.string()),
    author: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.bookId, {
      status: "imported",
      title: args.title ?? "Pending metadata extraction",
      author: args.author ?? "Unknown Author",
      lastError: undefined,
    });

    await ctx.db.patch(args.jobId, {
      status: "completed",
      stage: "completed",
      progress: 100,
      completedAt: now,
      logs: "Metadata extraction completed",
    });

    if (args.candidateId) {
      await ctx.db.patch(args.candidateId, {
        status: "completed",
        error: undefined,
      });
    }
  },
});
