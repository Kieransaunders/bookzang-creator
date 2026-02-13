import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const DEFAULT_LEASE_MS = 30_000;

export const recoverStaleLeases = mutation({
  args: {
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const leasedJobs = await ctx.db
      .query("ingestJobs")
      .withIndex("by_status", (q) => q.eq("status", "leased"))
      .collect();

    let recovered = 0;
    for (const job of leasedJobs) {
      if (!job.leaseExpiresAt || job.leaseExpiresAt > now) {
        continue;
      }

      await ctx.db.patch(job._id, {
        status: "queued",
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        updatedAt: now,
      });
      recovered += 1;
    }

    return { recovered };
  },
});

export const leaseNext = mutation({
  args: {
    workerId: v.string(),
    leaseMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("ingestJobs")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .first();

    if (!job) {
      return null;
    }

    const now = Date.now();
    const leaseMs = args.leaseMs ?? DEFAULT_LEASE_MS;

    await ctx.db.patch(job._id, {
      status: "leased",
      leaseOwner: args.workerId,
      leaseExpiresAt: now + leaseMs,
      updatedAt: now,
    });

    return job._id;
  },
});

export const heartbeat = mutation({
  args: {
    ingestJobId: v.id("ingestJobs"),
    workerId: v.string(),
    stage: v.optional(v.string()),
    leaseMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.ingestJobId);
    if (!job) {
      throw new Error("Ingest job not found");
    }

    if (job.status !== "leased" || job.leaseOwner !== args.workerId) {
      throw new Error("Worker does not hold lease");
    }

    const now = Date.now();
    const leaseMs = args.leaseMs ?? DEFAULT_LEASE_MS;
    await ctx.db.patch(job._id, {
      stage: args.stage,
      leaseExpiresAt: now + leaseMs,
      updatedAt: now,
    });

    return null;
  },
});

export const complete = mutation({
  args: {
    ingestJobId: v.id("ingestJobs"),
    workerId: v.string(),
    selectedFormat: v.string(),
    sourceUrl: v.string(),
    localSourcePath: v.string(),
    localExtractedPath: v.string(),
    checksum: v.string(),
    warning: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.ingestJobId);
    if (!job) {
      throw new Error("Ingest job not found");
    }

    if (job.leaseOwner !== args.workerId) {
      throw new Error("Worker does not hold lease");
    }

    const now = Date.now();
    await ctx.db.patch(job._id, {
      status: "completed",
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      stage: "completed",
      selectedFormat: args.selectedFormat,
      sourceUrl: args.sourceUrl,
      localSourcePath: args.localSourcePath,
      localExtractedPath: args.localExtractedPath,
      checksum: args.checksum,
      warning: args.warning,
      error: undefined,
      updatedAt: now,
    });

    return null;
  },
});

export const fail = mutation({
  args: {
    ingestJobId: v.id("ingestJobs"),
    error: v.string(),
    workerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.ingestJobId);
    if (!job) {
      throw new Error("Ingest job not found");
    }

    if (args.workerId && job.leaseOwner && job.leaseOwner !== args.workerId) {
      throw new Error("Worker does not hold lease");
    }

    await ctx.db.patch(job._id, {
      status: "failed",
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      stage: "failed",
      error: args.error,
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const listErrorEvents = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 100, 500));

    const failed = await ctx.db
      .query("ingestJobs")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .collect();

    const completed = await ctx.db
      .query("ingestJobs")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .collect();

    const warningRows = completed.filter((job) => Boolean(job.warning));
    const rows = [...failed, ...warningRows]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);

    return await Promise.all(
      rows.map(async (job) => {
        const book = await ctx.db.get(job.bookId);
        return {
          _id: job._id,
          _creationTime: job._creationTime,
          updatedAt: job.updatedAt,
          queuedAt: job.queuedAt,
          status: job.status,
          mode: job.mode,
          stage: job.stage,
          gutenbergId: job.gutenbergId,
          bookId: job.bookId,
          error: job.error,
          warning: job.warning,
          leaseOwner: job.leaseOwner,
          leaseExpiresAt: job.leaseExpiresAt,
          selectedFormat: job.selectedFormat,
          sourceUrl: job.sourceUrl,
          localSourcePath: job.localSourcePath,
          localExtractedPath: job.localExtractedPath,
          checksum: job.checksum,
          book: book
            ? {
                _id: book._id,
                title: book.title,
                author: book.author,
              }
            : null,
        };
      }),
    );
  },
});
