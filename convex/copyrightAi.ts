/**
 * Copyright Analysis Pipeline
 *
 * Simple header-based copyright checking - no AI required.
 * Parses Gutenberg headers for copyright warnings and publication dates.
 */

import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import {
  parseCopyrightFromHeader,
  type HeaderParseResult,
} from "./copyrightParser";

/**
 * Analyze copyright status from book file
 */
export const analyzeCopyright: ReturnType<typeof internalAction> =
  internalAction({
    args: {
      bookId: v.id("books"),
      triggerSource: v.optional(v.string()),
    },
    returns: v.object({
      success: v.boolean(),
      status: v.optional(
        v.union(
          v.literal("cleared"),
          v.literal("flagged"),
          v.literal("blocked"),
          v.literal("unknown"),
        ),
      ),
      error: v.optional(v.string()),
    }),
    handler: async (ctx, args) => {
      try {
        console.log(`Analyzing copyright for book ${args.bookId}`);

        const book = await ctx.runQuery(
          internal.copyrightAi.getBookForAnalysis,
          {
            bookId: args.bookId,
          },
        );

        if (!book?.fileId) {
          throw new Error(`Book ${args.bookId} has no file`);
        }

        // Read file content
        const contentBlob = await ctx.storage.get(book.fileId);
        if (!contentBlob) {
          throw new Error(`File not found for book ${args.bookId}`);
        }

        const text = await contentBlob.text();

        // Parse copyright from header
        const result = parseCopyrightFromHeader(text);

        // Store results
        await ctx.runMutation(internal.copyrightAi.storeAnalysis, {
          bookId: args.bookId,
          result,
          triggerSource: args.triggerSource,
        });

        console.log(`Copyright analysis complete: ${result.status}`);

        return {
          success: true,
          status: result.status,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`Copyright analysis failed:`, errorMessage);

        await ctx.runMutation(internal.copyrightAi.storeAnalysisFailure, {
          bookId: args.bookId,
          error: errorMessage,
          triggerSource: args.triggerSource,
        });

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
  });

/**
 * Store copyright analysis results
 */
export const storeAnalysis: ReturnType<typeof internalMutation> =
  internalMutation({
    args: {
      bookId: v.id("books"),
      result: v.any() as any, // HeaderParseResult
      triggerSource: v.optional(v.string()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      const result = args.result as HeaderParseResult;
      const now = Date.now();

      // Get existing check or create new
      const existing = await ctx.db
        .query("copyrightChecks")
        .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
        .first();

      const checkData = {
        bookId: args.bookId,
        status: result.status,
        headerAnalysis: {
          scanned: true,
          warningFlags: result.warnings,
          permissionNotes: result.permissionRequired
            ? "Permission required"
            : undefined,
          publicationYear: result.publicationYear ?? undefined,
        },
        assessment: {
          reason: result.reason,
        },
        metadata: {
          researchDate: new Date().toISOString(),
          triggerSource: args.triggerSource,
        },
        aiAssisted: false,
        researchedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, checkData);
      } else {
        await ctx.db.insert("copyrightChecks", checkData);
      }

      // Update book status
      await ctx.db.patch(args.bookId, {
        copyrightStatus: result.status,
      });

      return null;
    },
  });

export const getBookForAnalysis: ReturnType<typeof internalQuery> =
  internalQuery({
    args: {
      bookId: v.id("books"),
    },
    returns: v.union(
      v.null(),
      v.object({
        _id: v.id("books"),
        fileId: v.optional(v.id("_storage")),
      }),
    ),
    handler: async (ctx, args) => {
      const book = await ctx.db.get(args.bookId);
      if (!book) {
        return null;
      }

      return {
        _id: book._id,
        fileId: book.fileId,
      };
    },
  });

/**
 * Store analysis failure
 */
export const storeAnalysisFailure: ReturnType<typeof internalMutation> =
  internalMutation({
    args: {
      bookId: v.id("books"),
      error: v.string(),
      triggerSource: v.optional(v.string()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      const now = Date.now();

      const existing = await ctx.db
        .query("copyrightChecks")
        .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
        .first();

      const checkData = {
        bookId: args.bookId,
        status: "unknown" as const,
        error: args.error,
        metadata: {
          researchDate: new Date().toISOString(),
          triggerSource: args.triggerSource,
        },
        aiAssisted: false,
        researchedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, checkData);
      } else {
        await ctx.db.insert("copyrightChecks", checkData);
      }

      await ctx.db.patch(args.bookId, {
        copyrightStatus: "unknown",
      });

      return null;
    },
  });

/**
 * Manual status update
 */
export const updateCopyrightStatus: ReturnType<typeof internalMutation> =
  internalMutation({
    args: {
      bookId: v.id("books"),
      status: v.union(
        v.literal("unknown"),
        v.literal("checking"),
        v.literal("cleared"),
        v.literal("flagged"),
        v.literal("blocked"),
      ),
      reason: v.optional(v.string()),
      clearedBy: v.id("users"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      const now = Date.now();

      await ctx.db.patch(args.bookId, {
        copyrightStatus: args.status,
      });

      const existing = await ctx.db
        .query("copyrightChecks")
        .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
        .first();

      const checkData = {
        bookId: args.bookId,
        status: args.status,
        manualOverride: true,
        clearedBy: args.clearedBy,
        clearedAt: now,
        manualReason: args.reason,
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, checkData);
      } else {
        await ctx.db.insert("copyrightChecks", {
          ...checkData,
          researchedAt: now,
          aiAssisted: false,
        });
      }

      return null;
    },
  });

/**
 * Query copyright status for a book
 */
export const getCopyrightStatus: ReturnType<typeof query> = query({
  args: {
    bookId: v.id("books"),
  },
  returns: v.union(
    v.null(),
    v.object({
      bookId: v.id("books"),
      status: v.string(),
      reason: v.optional(v.string()),
      warnings: v.optional(v.array(v.string())),
      publicationYear: v.optional(v.number()),
      permissionRequired: v.optional(v.boolean()),
      researchedAt: v.optional(v.number()),
      manualOverride: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    const book = await ctx.db.get(args.bookId);
    if (!book) return null;

    const check = await ctx.db
      .query("copyrightChecks")
      .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
      .first();

    return {
      bookId: args.bookId,
      status: book.copyrightStatus || "unknown",
      reason: check?.assessment?.reason,
      warnings: check?.headerAnalysis?.warningFlags,
      publicationYear: check?.headerAnalysis?.publicationYear,
      permissionRequired: check?.headerAnalysis?.permissionNotes ? true : false,
      researchedAt: check?.researchedAt,
      manualOverride: check?.manualOverride,
    };
  },
});

/**
 * List all books with copyright status
 */
export const listCopyrightStatus: ReturnType<typeof query> = query({
  args: {},
  returns: v.array(
    v.object({
      bookId: v.id("books"),
      title: v.string(),
      author: v.string(),
      status: v.string(),
      publicationYear: v.optional(v.number()),
      warnings: v.optional(v.array(v.string())),
    }),
  ),
  handler: async (ctx) => {
    const books = await ctx.db.query("books").collect();

    const results = await Promise.all(
      books.map(async (book) => {
        const check = await ctx.db
          .query("copyrightChecks")
          .withIndex("by_book_id", (q) => q.eq("bookId", book._id))
          .first();

        return {
          bookId: book._id,
          title: book.title,
          author: book.author,
          status: book.copyrightStatus || "unknown",
          publicationYear: check?.headerAnalysis?.publicationYear,
          warnings: check?.headerAnalysis?.warningFlags,
        };
      }),
    );

    return results;
  },
});
