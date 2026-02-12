import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation } from "./_generated/server";

const internalApi = internal as any;

const findBookByGutenbergId = async (ctx: any, gutenbergId: string) => {
  return await ctx.db
    .query("books")
    .withIndex("by_gutenberg_id", (q: any) => q.eq("gutenbergId", gutenbergId))
    .first();
};

const enqueueSharedIntake = async (
  ctx: any,
  args: {
    source: "upload" | "discovery";
    fileId?: string;
    fileName?: string;
    gutenbergId?: string;
    title?: string;
    author?: string;
    sourcePath?: string;
    candidateId?: string;
  },
) => {
  const now = Date.now();
  const bookId = await ctx.db.insert("books", {
    title: args.title ?? "Pending metadata extraction",
    author: args.author ?? "Unknown Author",
    gutenbergId: args.gutenbergId,
    source: args.source,
    sourcePath: args.sourcePath,
    status: "importing",
    importedAt: now,
    fileId: args.fileId as any,
    fileName: args.fileName,
  });

  const jobId = await ctx.db.insert("jobs", {
    type: "import",
    status: "queued",
    stage: "queued",
    source: args.source,
    bookId,
    gutenbergId: args.gutenbergId,
    progress: 0,
    logs: "Queued for metadata extraction",
    queuedAt: now,
    discoveryCandidateId: args.candidateId as any,
  });

  if (args.candidateId) {
    await ctx.db.patch(args.candidateId as any, {
      status: "queued",
      queuedAt: now,
      linkedBookId: bookId,
      linkedJobId: jobId,
      error: undefined,
    });
  }

  await ctx.scheduler.runAfter(
    0,
    internalApi.intakeMetadata.extractAndPersist,
    {
      jobId,
      bookId,
      fileId: args.fileId,
      source: args.source,
      gutenbergId: args.gutenbergId,
      sourcePath: args.sourcePath,
      candidateId: args.candidateId,
    },
  );

  return { jobId, bookId };
};

export const enqueueUpload = mutation({
  args: {
    fileId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    gutenbergId: v.optional(v.string()),
    sourcePath: v.optional(v.string()),
    title: v.optional(v.string()),
    author: v.optional(v.string()),
    overrideDuplicate: v.optional(v.boolean()),
  },
  handler: async (ctx: any, args) => {
    if (args.gutenbergId) {
      const existing = await findBookByGutenbergId(ctx, args.gutenbergId);
      if (existing && !args.overrideDuplicate) {
        return {
          status: "duplicate_blocked" as const,
          duplicate: true,
          existingBookId: existing._id,
          gutenbergId: existing.gutenbergId,
          message: "A book with this Gutenberg ID already exists",
        };
      }
    }

    const enqueued = await enqueueSharedIntake(ctx, {
      source: "upload",
      fileId: args.fileId as unknown as string | undefined,
      fileName: args.fileName,
      gutenbergId: args.gutenbergId,
      sourcePath: args.sourcePath,
      title: args.title,
      author: args.author,
    });

    return {
      status: "enqueued" as const,
      duplicate: false,
      ...enqueued,
    };
  },
});

export const createDiscoveryCandidates = mutation({
  args: {
    limit: v.optional(v.number()),
    candidates: v.optional(
      v.array(
        v.object({
          gutenbergId: v.string(),
          sourcePath: v.string(),
          title: v.optional(v.string()),
          author: v.optional(v.string()),
          warning: v.optional(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx: any, args) => {
    const limit = args.limit ?? 5;
    const now = Date.now();

    const incoming =
      args.candidates?.slice(0, limit) ??
      Array.from({ length: limit }, (_, index) => {
        const gutenbergId = `${1400 + index}`;
        return {
          gutenbergId,
          sourcePath: `library/epub/${gutenbergId}/pg${gutenbergId}.txt`,
          title: `Candidate ${gutenbergId}`,
          author: "Unknown Author",
          warning: undefined,
        };
      });

    const createdCandidateIds = [];
    const existingCandidateIds = [];

    for (const candidate of incoming) {
      const existing = await ctx.db
        .query("discoveryCandidates")
        .withIndex("by_source_path", (q: any) =>
          q.eq("sourcePath", candidate.sourcePath),
        )
        .first();

      if (existing) {
        existingCandidateIds.push(existing._id);
        continue;
      }

      const candidateId = await ctx.db.insert("discoveryCandidates", {
        gutenbergId: candidate.gutenbergId,
        sourcePath: candidate.sourcePath,
        title: candidate.title,
        author: candidate.author,
        status: "discovered",
        discoveredAt: now,
        warning: candidate.warning,
      });
      createdCandidateIds.push(candidateId);
    }

    return {
      status: "ok" as const,
      created: createdCandidateIds.length,
      existing: existingCandidateIds.length,
      createdCandidateIds,
      existingCandidateIds,
    };
  },
});

export const enqueueDiscoveryCandidate = mutation({
  args: {
    candidateId: v.id("discoveryCandidates"),
    overrideDuplicate: v.optional(v.boolean()),
  },
  handler: async (ctx: any, args) => {
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) {
      throw new Error("Discovery candidate not found");
    }

    if (candidate.linkedJobId) {
      return {
        status: "already_enqueued" as const,
        duplicate: false,
        candidateId: candidate._id,
        bookId: candidate.linkedBookId,
        jobId: candidate.linkedJobId,
      };
    }

    const existing = await findBookByGutenbergId(ctx, candidate.gutenbergId);
    if (existing && !args.overrideDuplicate) {
      await ctx.db.patch(candidate._id, {
        status: "duplicate_blocked",
        linkedBookId: existing._id,
        error:
          "Duplicate Gutenberg ID. Use overrideDuplicate to import intentionally.",
      });

      return {
        status: "duplicate_blocked" as const,
        duplicate: true,
        candidateId: candidate._id,
        existingBookId: existing._id,
        gutenbergId: candidate.gutenbergId,
        message: "Duplicate blocked for discovery candidate",
      };
    }

    const enqueued = await enqueueSharedIntake(ctx, {
      source: "discovery",
      gutenbergId: candidate.gutenbergId,
      sourcePath: candidate.sourcePath,
      title: candidate.title,
      author: candidate.author,
      candidateId: candidate._id as unknown as string,
    });

    return {
      status: "enqueued" as const,
      duplicate: false,
      candidateId: candidate._id,
      ...enqueued,
    };
  },
});
