import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  books: defineTable({
    title: v.string(),
    author: v.string(),
    gutenbergId: v.optional(v.string()),
    source: v.union(v.literal("upload"), v.literal("discovery")),
    sourcePath: v.optional(v.string()),
    status: v.union(
      v.literal("discovered"),
      v.literal("importing"),
      v.literal("imported"),
      v.literal("failed"),
      v.literal("cleaned"),
      v.literal("ready"),
    ),
    templateId: v.optional(v.id("templates")),
    importedAt: v.number(),
    fileId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    lastError: v.optional(v.string()),
  })
    .index("by_gutenberg_id", ["gutenbergId"])
    .index("by_source_path", ["sourcePath"]),

  discoveryCandidates: defineTable({
    gutenbergId: v.string(),
    title: v.optional(v.string()),
    author: v.optional(v.string()),
    sourcePath: v.string(),
    status: v.union(
      v.literal("discovered"),
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("duplicate_blocked"),
    ),
    discoveredAt: v.number(),
    queuedAt: v.optional(v.number()),
    linkedBookId: v.optional(v.id("books")),
    linkedJobId: v.optional(v.id("jobs")),
    warning: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_gutenberg_id", ["gutenbergId"])
    .index("by_status", ["status"])
    .index("by_source_path", ["sourcePath"]),

  jobs: defineTable({
    type: v.union(v.literal("import"), v.literal("clean"), v.literal("export")),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    bookId: v.optional(v.id("books")),
    discoveryCandidateId: v.optional(v.id("discoveryCandidates")),
    gutenbergId: v.optional(v.string()),
    source: v.optional(v.union(v.literal("upload"), v.literal("discovery"))),
    progress: v.optional(v.number()),
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
    logs: v.optional(v.string()),
    error: v.optional(v.string()),
    errorDetails: v.optional(v.string()),
    queuedAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_book_id", ["bookId"])
    .index("by_gutenberg_id", ["gutenbergId"]),

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
