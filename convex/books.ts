import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let books = await ctx.db.query("books").order("desc").collect();
    
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      books = books.filter(book => 
        book.title.toLowerCase().includes(searchLower) ||
        book.author.toLowerCase().includes(searchLower)
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("books", {
      title: args.title,
      author: args.author,
      gutenbergId: `file-${Date.now()}`, // Generate a unique ID for uploaded files
      status: "imported",
      importedAt: Date.now(),
      fileId: args.fileId,
      fileName: args.fileName,
    });
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
