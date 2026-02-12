import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("jobs").order("desc").collect();
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
    stage: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("loading_file"),
        v.literal("parsing_metadata"),
        v.literal("persisting_metadata"),
        v.literal("completed"),
        v.literal("failed"),
      ),
    ),
    progress: v.optional(v.number()),
    logs: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { jobId, ...updates } = args;
    await ctx.db.patch(jobId, updates);
  },
});
