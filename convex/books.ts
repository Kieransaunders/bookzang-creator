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
