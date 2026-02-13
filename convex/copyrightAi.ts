/**
 * AI-Assisted Copyright Research Pipeline
 *
 * Internal actions for running AI copyright research on imported books.
 * Uses Kimi K2 to research contributor death dates and assess UK copyright status.
 */

import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { createCopyrightAiClient } from "./copyrightAiClient";
import type {
  CopyrightResearchResponse,
  Contributor,
} from "./copyrightPrompts";

/**
 * Internal action to research copyright status for a book
 *
 * Flow:
 * 1. Get book details and file content
 * 2. Extract header and scan for warnings
 * 3. Call AI to research contributors and death dates
 * 4. Store research results in copyrightChecks table
 * 5. Update book with copyright status
 */
export const researchCopyright: ReturnType<typeof internalAction> =
  internalAction({
    args: {
      bookId: v.id("books"),
      triggerSource: v.optional(v.string()), // e.g., "intake", "manual", "scheduled"
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
        console.log(
          `Starting copyright research for book ${args.bookId} (trigger: ${args.triggerSource || "unknown"})`,
        );

        // Get book details
        const book = await ctx.runQuery(
          internal.copyrightAi.getBookForResearch,
          {
            bookId: args.bookId,
          },
        );

        if (!book) {
          throw new Error(`Book ${args.bookId} not found`);
        }

        if (!book.fileId) {
          throw new Error(`Book ${args.bookId} has no fileId`);
        }

        // Get file content
        const contentBlob = await ctx.storage.get(book.fileId);
        if (!contentBlob) {
          throw new Error(
            `File ${book.fileId} not found for book ${args.bookId}`,
          );
        }
        const content = await contentBlob.text();

        // Create AI client
        const aiClient = createCopyrightAiClient();

        // Run copyright research
        const researchResult = await aiClient.researchCopyright(content, {
          title: book.title,
          author: book.author,
          gutenbergId: book.gutenbergId ?? undefined,
        });

        // Store research results
        await ctx.runMutation(internal.copyrightAi.storeResearchResults, {
          bookId: args.bookId,
          result: researchResult,
          triggerSource: args.triggerSource,
        });

        console.log(
          `Copyright research complete for book ${args.bookId}: ${researchResult.assessment.status}`,
        );

        return {
          success: true,
          status: researchResult.assessment.status,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `Copyright research failed for book ${args.bookId}:`,
          errorMessage,
        );

        // Store failure
        await ctx.runMutation(internal.copyrightAi.storeResearchFailure, {
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
 * Quick header scan for warning flags (no AI call)
 */
export const scanHeader: ReturnType<typeof internalAction> = internalAction({
  args: {
    bookId: v.id("books"),
  },
  returns: v.object({
    scanned: v.boolean(),
    warnings: v.array(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      const book = await ctx.runQuery(internal.copyrightAi.getBookForResearch, {
        bookId: args.bookId,
      });

      if (!book?.fileId) {
        return {
          scanned: false,
          warnings: [],
          error: "Book or file not found",
        };
      }

      const contentBlob = await ctx.storage.get(book.fileId);
      if (!contentBlob) {
        return {
          scanned: false,
          warnings: [],
          error: "File not found in storage",
        };
      }

      const content = await contentBlob.text();

      // Use client-side function to scan header
      const { checkHeaderWarnings, extractHeaderSection } =
        await import("./copyrightPrompts");
      const headerText = extractHeaderSection(content);
      const warnings = checkHeaderWarnings(headerText);

      // Store scan results
      await ctx.runMutation(internal.copyrightAi.storeHeaderScan, {
        bookId: args.bookId,
        warnings,
        headerPreview: headerText.slice(0, 1000),
      });

      return {
        scanned: true,
        warnings,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        scanned: false,
        warnings: [],
        error: errorMessage,
      };
    }
  },
});

// =============================================================================
// Internal Queries
// =============================================================================

/**
 * Get book details for copyright research
 */
export const getBookForResearch: ReturnType<typeof internalQuery> =
  internalQuery({
    args: {
      bookId: v.id("books"),
    },
    returns: v.union(
      v.null(),
      v.object({
        _id: v.id("books"),
        title: v.string(),
        author: v.string(),
        gutenbergId: v.optional(v.string()),
        fileId: v.optional(v.id("_storage")),
        copyrightStatus: v.optional(
          v.union(
            v.literal("unknown"),
            v.literal("checking"),
            v.literal("cleared"),
            v.literal("flagged"),
            v.literal("blocked"),
          ),
        ),
      }),
    ),
    handler: async (ctx, args) => {
      const book = await ctx.db.get(args.bookId);
      if (!book) return null;

      return {
        _id: book._id,
        title: book.title,
        author: book.author,
        gutenbergId: book.gutenbergId ?? undefined,
        fileId: book.fileId ?? undefined,
        copyrightStatus: book.copyrightStatus ?? undefined,
      };
    },
  });

// =============================================================================
// Internal Mutations
// =============================================================================

/**
 * Store copyright research results
 */
export const storeResearchResults: ReturnType<typeof internalMutation> =
  internalMutation({
    args: {
      bookId: v.id("books"),
      result: v.any() as any, // CopyrightResearchResponse - validated in handler
      triggerSource: v.optional(v.string()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      const result = args.result as CopyrightResearchResponse;
      const now = Date.now();

      // Create or update copyright check record
      const existingCheck = await ctx.db
        .query("copyrightChecks")
        .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
        .first();

      const contributorsData = result.contributors.map((c: Contributor) => ({
        name: c.name,
        role: c.role,
        deathYear: c.deathYear ?? undefined,
        confidence: c.confidence,
        source: c.source,
        notes: c.notes,
      }));

      const checkData = {
        bookId: args.bookId,
        status: result.assessment.status,
        contributors: contributorsData,
        assessment: {
          reason: result.assessment.reason,
          latestDeathYear: result.assessment.latestDeathYear ?? undefined,
          yearsSinceDeath: result.assessment.yearsSinceDeath ?? undefined,
        },
        headerAnalysis: {
          scanned: result.headerAnalysis.scanned,
          permissionNotes: result.headerAnalysis.permissionNotes,
          warningFlags: result.headerAnalysis.warningFlags,
        },
        metadata: {
          researchDate: result.metadata.researchDate,
          gutenbergId: result.metadata.gutenbergId,
          title: result.metadata.title,
          triggerSource: args.triggerSource,
        },
        researchedAt: now,
        aiAssisted: true,
      };

      if (existingCheck) {
        await ctx.db.patch(existingCheck._id, checkData);
      } else {
        await ctx.db.insert("copyrightChecks", checkData);
      }

      // Update book status
      await ctx.db.patch(args.bookId, {
        copyrightStatus: result.assessment.status,
      });

      return null;
    },
  });

/**
 * Store research failure
 */
export const storeResearchFailure: ReturnType<typeof internalMutation> =
  internalMutation({
    args: {
      bookId: v.id("books"),
      error: v.string(),
      triggerSource: v.optional(v.string()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      const now = Date.now();

      const existingCheck = await ctx.db
        .query("copyrightChecks")
        .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
        .first();

      const book = await ctx.db.get(args.bookId);

      const checkData = {
        bookId: args.bookId,
        status: "unknown" as const,
        error: args.error,
        metadata: {
          researchDate: new Date().toISOString(),
          title: book?.title || "Unknown Title",
          triggerSource: args.triggerSource,
        },
        researchedAt: now,
        aiAssisted: false,
      };

      if (existingCheck) {
        await ctx.db.patch(existingCheck._id, checkData);
      } else {
        await ctx.db.insert("copyrightChecks", checkData);
      }

      // Update book to unknown status
      await ctx.db.patch(args.bookId, {
        copyrightStatus: "unknown",
      });

      return null;
    },
  });

/**
 * Store header scan results
 */
export const storeHeaderScan: ReturnType<typeof internalMutation> =
  internalMutation({
    args: {
      bookId: v.id("books"),
      warnings: v.array(v.string()),
      headerPreview: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      const existingCheck = await ctx.db
        .query("copyrightChecks")
        .withIndex("by_book_id", (q) => q.eq("bookId", args.bookId))
        .first();

      const checkData = {
        bookId: args.bookId,
        headerAnalysis: {
          scanned: true,
          warningFlags: args.warnings,
          headerPreview: args.headerPreview,
        },
        // If there are warnings, flag for review
        status: args.warnings.length > 0 ? ("flagged" as const) : undefined,
      };

      if (existingCheck) {
        await ctx.db.patch(existingCheck._id, checkData);
      } else {
        await ctx.db.insert("copyrightChecks", {
          ...checkData,
          status: args.warnings.length > 0 ? "flagged" : "unknown",
          researchedAt: Date.now(),
          aiAssisted: false,
        });
      }

      // Update book status if warnings found
      if (args.warnings.length > 0) {
        await ctx.db.patch(args.bookId, {
          copyrightStatus: "flagged",
        });
      }

      return null;
    },
  });

/**
 * Manual copyright status update (for user override)
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
      manualDeathYears: v.optional(
        v.array(
          v.object({
            name: v.string(),
            role: v.string(),
            deathYear: v.number(),
          }),
        ),
      ),
      clearedBy: v.id("users"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      const now = Date.now();

      // Update book status
      await ctx.db.patch(args.bookId, {
        copyrightStatus: args.status,
      });

      // Create or update check record
      const existingCheck = await ctx.db
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
        manualContributors: args.manualDeathYears,
        updatedAt: now,
      };

      if (existingCheck) {
        await ctx.db.patch(existingCheck._id, checkData);
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
