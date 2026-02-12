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

    return books;
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
      .withIndex("by_book_id", q => q.eq("bookId", args.bookId))
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
      .filter(q => q.eq(q.field("status"), "ready"))
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
