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

  // Cleanup revision tracking - immutable original + versioned cleaned revisions
  // NOTE: Content is stored in Convex File Storage, not in database (1MB limit)
  cleanupOriginals: defineTable({
    bookId: v.id("books"),
    fileId: v.optional(v.id("_storage")),  // Reference to stored original file
    capturedAt: v.number(),
    sourceFormat: v.union(v.literal("gutenberg_txt"), v.literal("markdown")),
    sizeBytes: v.optional(v.number()),  // Track original size
    // DEPRECATED: content stored directly (removed due to 1MB limit)
    content: v.optional(v.string()),
  })
    .index("by_book_id", ["bookId"]),

  cleanupRevisions: defineTable({
    bookId: v.id("books"),
    revisionNumber: v.number(),
    fileId: v.optional(v.id("_storage")),  // Reference to stored cleaned file
    isDeterministic: v.boolean(),
    isAiAssisted: v.boolean(),
    preserveArchaic: v.boolean(),
    createdAt: v.number(),
    createdBy: v.union(v.literal("system"), v.literal("ai"), v.literal("user")),
    parentRevisionId: v.optional(v.id("cleanupRevisions")),
    sizeBytes: v.optional(v.number()),  // Track cleaned size
    chapterIds: v.optional(v.array(v.id("cleanupChapters"))),  // References to chapter records
    // DEPRECATED: content stored directly (removed due to 1MB limit)
    content: v.optional(v.string()),
  })
    .index("by_book_id", ["bookId"])
    .index("by_book_id_revision", ["bookId", "revisionNumber"]),

  // Chapter segmentation - sections of the book with type labels
  // NOTE: Content is stored in Convex File Storage, not in database (1MB limit)
  cleanupChapters: defineTable({
    bookId: v.id("books"),
    revisionId: v.id("cleanupRevisions"),
    chapterNumber: v.number(),
    title: v.string(),
    type: v.union(
      v.literal("chapter"),
      v.literal("preface"),
      v.literal("introduction"),
      v.literal("notes"),
      v.literal("appendix"),
      v.literal("body"),
    ),
    fileId: v.optional(v.id("_storage")),  // Reference to stored chapter content file
    startOffset: v.number(),
    endOffset: v.number(),
    detectedHeading: v.optional(v.string()),
    isUserConfirmed: v.boolean(),
    createdAt: v.number(),
    sizeBytes: v.optional(v.number()),  // Track chapter content size
    // DEPRECATED: content stored directly (removed due to 1MB limit)
    content: v.optional(v.string()),
  })
    .index("by_book_id", ["bookId"])
    .index("by_revision_id", ["revisionId"])
    .index("by_book_chapter_number", ["bookId", "chapterNumber"]),

  // Review flags for ambiguous boundaries and low-confidence cleanup
  cleanupFlags: defineTable({
    bookId: v.id("books"),
    revisionId: v.id("cleanupRevisions"),
    type: v.union(
      v.literal("unlabeled_boundary_candidate"),
      v.literal("low_confidence_cleanup"),
      v.literal("ocr_corruption_detected"),
      v.literal("ambiguous_punctuation"),
      v.literal("chapter_boundary_disputed"),
    ),
    status: v.union(v.literal("unresolved"), v.literal("confirmed"), v.literal("rejected"), v.literal("overridden")),
    chapterId: v.optional(v.id("cleanupChapters")),
    startOffset: v.number(),
    endOffset: v.number(),
    contextText: v.string(),
    suggestedAction: v.optional(v.string()),
    reviewerNote: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_book_id", ["bookId"])
    .index("by_revision_id", ["revisionId"])
    .index("by_book_status", ["bookId", "status"])
    .index("by_status", ["status"]),

  // Cleanup jobs for tracking pipeline progress
  cleanupJobs: defineTable({
    bookId: v.id("books"),
    revisionId: v.optional(v.id("cleanupRevisions")),
    stage: v.union(
      v.literal("queued"),
      v.literal("loading_original"),
      v.literal("boilerplate_removal"),
      v.literal("paragraph_unwrap"),
      v.literal("chapter_detection"),
      v.literal("punctuation_normalization"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    status: v.union(v.literal("queued"), v.literal("running"), v.literal("completed"), v.literal("failed")),
    progress: v.number(),
    flagsCreated: v.number(),
    chaptersDetected: v.optional(v.number()),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    queuedAt: v.number(),
  })
    .index("by_book_id", ["bookId"])
    .index("by_status", ["status"])
    .index("by_stage", ["stage"]),

  // Approval records for cleaned revisions
  cleanupApprovals: defineTable({
    bookId: v.id("books"),
    revisionId: v.id("cleanupRevisions"),
    approvedBy: v.id("users"),
    approvedAt: v.number(),
    checklistConfirmed: v.object({
      boilerplateRemoved: v.boolean(),
      chapterBoundariesVerified: v.boolean(),
      punctuationReviewed: v.boolean(),
      archaicPreserved: v.boolean(),
    }),
  })
    .index("by_book_id", ["bookId"])
    .index("by_revision_id", ["revisionId"])
    .index("by_book_revision", ["bookId", "revisionId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
