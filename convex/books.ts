import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const list = query({
  args: {
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let books = await ctx.db.query("books").order("desc").collect();

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      books = books.filter(
        (book) =>
          book.title.toLowerCase().includes(searchLower) ||
          book.author.toLowerCase().includes(searchLower),
      );
    }

    return await Promise.all(
      books.map(async (book) => {
        const check = await ctx.db
          .query("copyrightChecks")
          .withIndex("by_book_id", (q) => q.eq("bookId", book._id))
          .first();

        return {
          ...book,
          copyrightReason: check?.assessment?.reason,
          copyrightPublicationYear: check?.headerAnalysis?.publicationYear,
          copyrightWarnings: check?.headerAnalysis?.warningFlags,
        };
      }),
    );
  },
});

export const get = query({
  args: { id: v.id("books") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    author: v.string(),
    gutenbergId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("books", {
      ...args,
      source: "discovery",
      status: "imported",
      importedAt: Date.now(),
    });
  },
});

export const createFromFile = mutation({
  args: {
    title: v.string(),
    author: v.string(),
    fileId: v.id("_storage"),
    fileName: v.string(),
    gutenbergId: v.optional(v.string()),
    overrideDuplicate: v.optional(v.boolean()),
  },
  handler: async (ctx: any, args): Promise<any> => {
    return await ctx.runMutation((api as any).intake.enqueueUpload, {
      fileId: args.fileId,
      fileName: args.fileName,
      gutenbergId: args.gutenbergId,
      title: args.title,
      author: args.author,
      overrideDuplicate: args.overrideDuplicate,
    });
  },
});

export const byGutenbergId = query({
  args: { gutenbergId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("books")
      .withIndex("by_gutenberg_id", (q) =>
        q.eq("gutenbergId", args.gutenbergId),
      )
      .first();
  },
});

export const updateTemplate = mutation({
  args: {
    bookId: v.id("books"),
    templateId: v.id("templates"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.bookId, {
      templateId: args.templateId,
    });
  },
});

/**
 * Check if a book is ready for downstream actions (template/export)
 * Book must have status "ready" meaning cleanup is approved
 */
export const getDownstreamReadiness = query({
  args: {
    bookId: v.id("books"),
  },
  returns: v.object({
    isReady: v.boolean(),
    status: v.union(
      v.literal("discovered"),
      v.literal("importing"),
      v.literal("imported"),
      v.literal("failed"),
      v.literal("cleaned"),
      v.literal("ready"),
    ),
    hasApprovedCleanup: v.boolean(),
    requiredActions: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const book = await ctx.db.get(args.bookId);
    if (!book) {
      throw new Error(`Book ${args.bookId} not found`);
    }

    const requiredActions: string[] = [];

    // Check if book has approved cleanup (status "ready")
    const hasApprovedCleanup = book.status === "ready";

    if (!hasApprovedCleanup) {
      if (book.status === "cleaned") {
        requiredActions.push("Review and approve cleanup in the review page");
      } else if (book.status === "imported" || book.status === "discovered") {
        requiredActions.push("Run cleanup process first");
      } else if (book.status === "failed") {
        requiredActions.push("Fix import errors and re-import");
      }
    }

    // Check if book has content
    const revisions = await ctx.db
      .query("cleanupRevisions")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
      .take(1);

    if (revisions.length === 0) {
      requiredActions.push("Wait for cleanup to complete");
    }

    return {
      isReady: hasApprovedCleanup && revisions.length > 0,
      status: book.status,
      hasApprovedCleanup,
      requiredActions,
    };
  },
});

/**
 * List books that are ready for template/export (approved cleanup)
 */
export const listReadyBooks = query({
  args: {
    search: v.optional(v.string()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let books = await ctx.db
      .query("books")
      .filter((q) => q.eq(q.field("status"), "ready"))
      .order("desc")
      .collect();

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      books = books.filter(
        (book) =>
          book.title.toLowerCase().includes(searchLower) ||
          book.author.toLowerCase().includes(searchLower),
      );
    }

    return books;
  },
});

/**
 * Delete a book and all associated cleanup data
 * This is a hard delete - use with caution
 */
export const deleteBook = mutation({
  args: {
    bookId: v.id("books"),
  },
  returns: v.object({
    success: v.boolean(),
    deleted: v.object({
      originals: v.number(),
      revisions: v.number(),
      chapters: v.number(),
      flags: v.number(),
      jobs: v.number(),
      cleanupJobs: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    // Check book exists
    const book = await ctx.db.get(args.bookId);
    if (!book) {
      throw new Error(`Book ${args.bookId} not found`);
    }

    let originalsDeleted = 0;
    let revisionsDeleted = 0;
    let chaptersDeleted = 0;
    let flagsDeleted = 0;
    let jobsDeleted = 0;
    let cleanupJobsDeleted = 0;

    // Delete cleanup originals
    const originals = await ctx.db
      .query("cleanupOriginals")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
      .collect();
    for (const orig of originals) {
      await ctx.db.delete(orig._id);
      originalsDeleted++;
    }

    // Delete cleanup revisions (and their chapters)
    const revisions = await ctx.db
      .query("cleanupRevisions")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
      .collect();
    for (const rev of revisions) {
      await ctx.db.delete(rev._id);
      revisionsDeleted++;
    }

    // Delete chapters
    const chapters = await ctx.db
      .query("cleanupChapters")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
      .collect();
    for (const ch of chapters) {
      await ctx.db.delete(ch._id);
      chaptersDeleted++;
    }

    // Delete flags
    const flags = await ctx.db
      .query("cleanupFlags")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
      .collect();
    for (const flag of flags) {
      await ctx.db.delete(flag._id);
      flagsDeleted++;
    }

    // Delete cleanup jobs
    const cleanupJobs = await ctx.db
      .query("cleanupJobs")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
      .collect();
    for (const job of cleanupJobs) {
      await ctx.db.delete(job._id);
      cleanupJobsDeleted++;
    }

    // Delete main jobs
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
      .collect();
    for (const job of jobs) {
      await ctx.db.delete(job._id);
      jobsDeleted++;
    }

    // Finally delete the book
    await ctx.db.delete(args.bookId);

    return {
      success: true,
      deleted: {
        originals: originalsDeleted,
        revisions: revisionsDeleted,
        chapters: chaptersDeleted,
        flags: flagsDeleted,
        jobs: jobsDeleted,
        cleanupJobs: cleanupJobsDeleted,
      },
    };
  },
});
