import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const ingestStatusValidator = v.union(
  v.literal("queued"),
  v.literal("leased"),
  v.literal("completed"),
  v.literal("failed"),
);

type IngestStatus = "queued" | "leased" | "completed" | "failed";

const ALLOWED_TRANSITIONS: Record<IngestStatus, IngestStatus[]> = {
  queued: ["leased", "failed"],
  leased: ["completed", "failed", "queued"],
  completed: [],
  failed: ["queued"],
};

export function canTransitionIngestStatus(
  from: IngestStatus,
  to: IngestStatus,
) {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export const enqueue = mutation({
  args: {
    bookId: v.id("books"),
    gutenbergId: v.string(),
    mode: v.union(v.literal("quality"), v.literal("fast")),
  },
  returns: v.id("ingestJobs"),
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("ingestJobs", {
      bookId: args.bookId,
      gutenbergId: args.gutenbergId,
      mode: args.mode,
      status: "queued",
      queuedAt: now,
      updatedAt: now,
    });
  },
});

export const leaseNext = mutation({
  args: {
    workerId: v.string(),
    leaseMs: v.optional(v.number()),
  },
  returns: v.union(v.null(), v.id("ingestJobs")),
  handler: async (ctx, args) => {
    const leaseMs = args.leaseMs ?? 30_000;
    const now = Date.now();
    const queued = await ctx.db
      .query("ingestJobs")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .first();

    if (!queued) {
      return null;
    }

    await ctx.db.patch(queued._id, {
      status: "leased",
      leaseOwner: args.workerId,
      leaseExpiresAt: now + leaseMs,
      updatedAt: now,
    });

    return queued._id;
  },
});

export const recoverStaleLeases = mutation({
  args: {
    now: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const leased = await ctx.db
      .query("ingestJobs")
      .withIndex("by_status", (q) => q.eq("status", "leased"))
      .collect();

    const stale = leased.filter(
      (job) => typeof job.leaseExpiresAt === "number" && job.leaseExpiresAt < now,
    );

    for (const job of stale) {
      await ctx.db.patch(job._id, {
        status: "queued",
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        stage: job.stage ?? "recovered_stale_lease",
        updatedAt: now,
      });
    }

    return stale.length;
  },
});

export const heartbeat = mutation({
  args: {
    ingestJobId: v.id("ingestJobs"),
    workerId: v.string(),
    stage: v.optional(v.string()),
    leaseMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.ingestJobId);
    if (!job) {
      throw new Error("Ingest job not found");
    }
    if (job.status !== "leased") {
      throw new Error("Ingest job is not leased");
    }
    if (job.leaseOwner !== args.workerId) {
      throw new Error("Worker does not own lease");
    }

    const now = Date.now();
    await ctx.db.patch(args.ingestJobId, {
      stage: args.stage ?? job.stage,
      leaseExpiresAt: now + (args.leaseMs ?? 30_000),
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
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.ingestJobId);
    if (!job) {
      throw new Error("Ingest job not found");
    }
    if (job.leaseOwner !== args.workerId || job.status !== "leased") {
      throw new Error("Only leasing worker can complete job");
    }

    await ctx.db.patch(args.ingestJobId, {
      status: "completed",
      selectedFormat: args.selectedFormat,
      sourceUrl: args.sourceUrl,
      localSourcePath: args.localSourcePath,
      localExtractedPath: args.localExtractedPath,
      checksum: args.checksum,
      warning: args.warning,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const fail = mutation({
  args: {
    ingestJobId: v.id("ingestJobs"),
    workerId: v.optional(v.string()),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.ingestJobId);
    if (!job) {
      throw new Error("Ingest job not found");
    }

    if (job.status === "leased" && args.workerId && job.leaseOwner !== args.workerId) {
      throw new Error("Worker does not own lease");
    }

    await ctx.db.patch(args.ingestJobId, {
      status: "failed",
      error: args.error,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const listByStatus = query({
  args: {
    status: ingestStatusValidator,
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ingestJobs")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});
