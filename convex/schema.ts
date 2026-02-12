import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  books: defineTable({
    title: v.string(),
    author: v.string(),
    gutenbergId: v.string(),
    status: v.union(v.literal("imported"), v.literal("cleaned"), v.literal("ready")),
    templateId: v.optional(v.id("templates")),
    importedAt: v.number(),
    fileId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
  }).index("by_gutenberg_id", ["gutenbergId"]),

  jobs: defineTable({
    type: v.union(v.literal("import"), v.literal("clean"), v.literal("export")),
    status: v.union(v.literal("queued"), v.literal("running"), v.literal("done"), v.literal("error")),
    bookId: v.optional(v.id("books")),
    gutenbergId: v.optional(v.string()),
    progress: v.optional(v.number()),
    logs: v.optional(v.string()),
    error: v.optional(v.string()),
  }),

  templates: defineTable({
    name: v.string(),
    description: v.string(),
    preview: v.string(),
    settings: v.object({
      fontSize: v.number(),
      lineHeight: v.number(),
      margins: v.object({
        top: v.number(),
        bottom: v.number(),
        left: v.number(),
        right: v.number(),
      }),
    }),
  }),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
