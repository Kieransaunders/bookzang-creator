import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { mainJobStageValidator } from "./jobStages";

const canonicalStatuses = ["queued", "running", "completed", "failed"] as const;

const buildErrorSnippet = (job: {
  error?: string;
  errorDetails?: string;
  logs?: string;
}) => {
  const source = job.error ?? job.errorDetails ?? job.logs;
  if (!source) {
    return undefined;
  }

  const normalized = source.replace(/\s+/g, " ").trim();
  if (normalized.length <= 140) {
    return normalized;
  }

  return `${normalized.slice(0, 137)}...`;
};

const toDetailedJobRow = (job: any, book: any) => ({
  _id: job._id,
  _creationTime: job._creationTime,
  type: job.type,
  status: job.status,
  stage: job.stage ?? "queued",
  progress: job.progress ?? 0,
  bookId: job.bookId,
  gutenbergId: job.gutenbergId,
  source: job.source,
  queuedAt: job.queuedAt,
  startedAt: job.startedAt,
  completedAt: job.completedAt,
  failedAt: job.failedAt,
  errorSnippet: buildErrorSnippet(job),
  error: job.error,
  errorDetails: job.errorDetails,
  logs: job.logs,
  book: book
    ? {
        _id: book._id,
        title: book.title,
        author: book.author,
      }
    : undefined,
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("jobs").order("desc").collect();
  },
});

export const listDetailed = query({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db.query("jobs").order("desc").collect();

    return await Promise.all(
      jobs.map(async (job) => {
        const book = job.bookId ? await ctx.db.get(job.bookId) : null;
        return toDetailedJobRow(job, book);
      }),
    );
  },
});

export const listGroupedSummary = query({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db.query("jobs").order("desc").collect();

    const bookCache = new Map<string, any>();

    const detailedRows = await Promise.all(
      jobs.map(async (job) => {
        if (!job.bookId) {
          return toDetailedJobRow(job, null);
        }

        const key = String(job.bookId);
        if (!bookCache.has(key)) {
          const book = await ctx.db.get(job.bookId);
          bookCache.set(key, book ?? null);
        }

        return toDetailedJobRow(job, bookCache.get(key));
      }),
    );

    const grouped = new Map<
      string,
      {
        groupKey: string;
        bookId?: any;
        gutenbergId?: string;
        book?: { _id: any; title: string; author: string };
        totalJobs: number;
        statuses: Record<(typeof canonicalStatuses)[number], number>;
        latestQueuedAt: number;
        latestCreatedAt: number;
        jobs: ReturnType<typeof toDetailedJobRow>[];
      }
    >();

    for (const row of detailedRows) {
      const groupKey = row.bookId
        ? `book:${String(row.bookId)}`
        : row.gutenbergId
          ? `gutenberg:${row.gutenbergId}`
          : `job:${String(row._id)}`;

      const existing = grouped.get(groupKey);
      if (existing) {
        existing.totalJobs += 1;
        existing.statuses[row.status as (typeof canonicalStatuses)[number]] +=
          1;
        existing.latestQueuedAt = Math.max(
          existing.latestQueuedAt,
          row.queuedAt ?? 0,
        );
        existing.latestCreatedAt = Math.max(
          existing.latestCreatedAt,
          row._creationTime,
        );
        existing.jobs.push(row);
        continue;
      }

      const statuses = {
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
      };
      statuses[row.status as (typeof canonicalStatuses)[number]] = 1;

      grouped.set(groupKey, {
        groupKey,
        bookId: row.bookId,
        gutenbergId: row.gutenbergId,
        book: row.book,
        totalJobs: 1,
        statuses,
        latestQueuedAt: row.queuedAt ?? 0,
        latestCreatedAt: row._creationTime,
        jobs: [row],
      });
    }

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        hasMultipleJobs: group.totalJobs > 1,
      }))
      .sort((a, b) => b.latestCreatedAt - a.latestCreatedAt);
  },
});

export const get = query({
  args: { id: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    type: v.union(v.literal("import"), v.literal("clean"), v.literal("export")),
    bookId: v.optional(v.id("books")),
    gutenbergId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("jobs", {
      ...args,
      status: "queued",
      stage: "queued",
      progress: 0,
      logs: "",
      queuedAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    jobId: v.id("jobs"),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    stage: v.optional(mainJobStageValidator),
    progress: v.optional(v.number()),
    logs: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { jobId, ...updates } = args;
    await ctx.db.patch(jobId, updates);
  },
});
