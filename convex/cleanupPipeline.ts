/**
 * Deterministic cleanup pipeline
 * 
 * Server-side deterministic transforms for Gutenberg text processing.
 * Produces immutable cleaned revisions with flag generation for ambiguous content.
 */

import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { detectChapterBoundaries } from "./cleanupChaptering";

// Gutenberg boilerplate markers
const GUTENBERG_START_MARKERS = [
  /^\*\*\* START OF (THIS|THE) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/im,
  /^\*\*\* START OF (THIS|THE) PROJECT GUTENBERG[^*]*\*\*\*/im,
  /^START OF (THIS|THE) PROJECT GUTENBERG EBOOK/im,
];

const GUTENBERG_END_MARKERS = [
  /^\*\*\* END OF (THIS|THE) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/im,
  /^\*\*\* END OF (THIS|THE) PROJECT GUTENBERG[^*]*\*\*\*/im,
  /^END OF (THIS|THE) PROJECT GUTENBERG EBOOK/im,
  /^\s*End of Project Gutenberg['"]?s?/im,
  /^\s*End of the Project Gutenberg/im,
];

/**
 * Strip Gutenberg boilerplate from text
 */
export function stripGutenbergBoilerplate(text: string): {
  content: string;
  startMarkerFound: boolean;
  endMarkerFound: boolean;
} {
  let content = text;
  let startMarkerFound = false;
  let endMarkerFound = false;

  for (const pattern of GUTENBERG_START_MARKERS) {
    const match = content.match(pattern);
    if (match && match.index !== undefined) {
      content = content.slice(match.index + match[0].length);
      startMarkerFound = true;
      break;
    }
  }

  for (const pattern of GUTENBERG_END_MARKERS) {
    const match = content.match(pattern);
    if (match && match.index !== undefined) {
      content = content.slice(0, match.index);
      endMarkerFound = true;
      break;
    }
  }

  content = content.trim();

  return { content, startMarkerFound, endMarkerFound };
}

/**
 * Apply balanced paragraph unwrapping
 */
export function unwrapParagraphs(text: string): {
  content: string;
  unwrappedCount: number;
  ambiguousPositions: Array<{ offset: number; context: string; lineNumber: number }>;
} {
  const lines = text.split("\n");
  const result: string[] = [];
  let currentParagraph = "";
  let unwrappedCount = 0;
  const ambiguousPositions: Array<{ offset: number; context: string; lineNumber: number }> = [];
  let currentOffset = 0;

  const SENTENCE_ENDERS = /[.!?]["']?\s*$/;
  const STRONG_CONTINUATION = /^[a-z]/;
  const LIKELY_HEADER = /^(CHAPTER|BOOK|PART|SCENE|ACT|PREFACE|INTRODUCTION|APPENDIX|NOTES)\s/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : null;

    if (!trimmed) {
      if (currentParagraph) {
        result.push(currentParagraph);
        currentParagraph = "";
      }
      result.push("");
      currentOffset += line.length + 1;
      continue;
    }

    // Don't unwrap across likely headers
    if (LIKELY_HEADER.test(trimmed)) {
      if (currentParagraph) {
        result.push(currentParagraph);
        currentParagraph = "";
      }
      result.push(trimmed);
      currentOffset += line.length + 1;
      continue;
    }

    if (!currentParagraph) {
      currentParagraph = trimmed;
      currentOffset += line.length + 1;
      continue;
    }

    const endsWithSentence = SENTENCE_ENDERS.test(currentParagraph);
    const nextStartsLower = nextLine ? STRONG_CONTINUATION.test(nextLine) : false;

    if (!endsWithSentence && nextStartsLower && !LIKELY_HEADER.test(currentParagraph)) {
      currentParagraph += " " + trimmed;
      unwrappedCount++;
    } else if (!endsWithSentence && nextLine && !nextLine.match(/^[A-Z]/)) {
      // Ambiguous case
      const contextStart = Math.max(0, currentParagraph.length - 30);
      ambiguousPositions.push({
        offset: currentOffset + contextStart,
        context: `${currentParagraph.slice(contextStart)} || ${trimmed.slice(0, 30)}`,
        lineNumber: i,
      });
      currentParagraph += " " + trimmed;
      unwrappedCount++;
    } else {
      result.push(currentParagraph);
      currentParagraph = trimmed;
    }

    currentOffset += line.length + 1;
  }

  if (currentParagraph) {
    result.push(currentParagraph);
  }

  return {
    content: result.join("\n"),
    unwrappedCount,
    ambiguousPositions,
  };
}

/**
 * Normalize punctuation with high-confidence patterns only
 */
export function normalizePunctuation(text: string): {
  content: string;
  changes: number;
  lowConfidencePositions: Array<{ offset: number; context: string; lineNumber: number }>;
} {
  let result = text;
  let changes = 0;
  const lowConfidencePositions: Array<{ offset: number; context: string; lineNumber: number }> = [];

  const highConfidenceReplacements: Array<[RegExp, string]> = [
    [/([.!?])  +/g, "$1 "],
    [/([a-zA-Z.,;:!?])"/g, "$1\""],
    [/^"([a-zA-Z])/gm, "\"$1"],
    [/--/g, "—"],
    [/\.\.\./g, "…"],
  ];

  for (const [pattern, replacement] of highConfidenceReplacements) {
    result = result.replace(pattern, (match) => {
      changes++;
      return replacement;
    });
  }

  // Flag low-confidence patterns
  const lines = text.split("\n");
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Archaic punctuation that might be intentional
    const archaicPattern = /\b([a-zA-Z]+)'([a-zA-Z]+)\b/g;
    let match;
    while ((match = archaicPattern.exec(line)) !== null) {
      lowConfidencePositions.push({
        offset: offset + match.index,
        context: `archaic punctuation: "${match[0]}"`,
        lineNumber: i,
      });
    }

    offset += line.length + 1;
  }

  return { content: result, changes, lowConfidencePositions };
}

/**
 * Result of deterministic cleanup
 */
export interface CleanupResult {
  content: string;
  boilerplateStripped: boolean;
  startMarkerFound: boolean;
  endMarkerFound: boolean;
  unwrappedCount: number;
  punctuationChanges: number;
  chaptersDetected: number;
  unlabeledBreaks: Array<{ offset: number; pattern: string; lineNumber: number }>;
  ambiguousPositions: Array<{ offset: number; context: string; lineNumber: number }>;
  lowConfidencePunctuation: Array<{ offset: number; context: string; lineNumber: number }>;
}

/**
 * Run full deterministic cleanup pipeline
 */
export function runDeterministicCleanup(
  text: string,
  options: {
    preserveArchaic?: boolean;
    unwrapParagraphs?: boolean;
    normalizePunctuation?: boolean;
  } = {},
): CleanupResult {
  const unlabeledBreaks: Array<{ offset: number; pattern: string; lineNumber: number }> = [];
  const ambiguousPositions: Array<{ offset: number; context: string; lineNumber: number }> = [];
  const lowConfidencePunctuation: Array<{ offset: number; context: string; lineNumber: number }> = [];

  // Step 1: Strip boilerplate
  const boilerplateResult = stripGutenbergBoilerplate(text);
  let content = boilerplateResult.content;

  // Step 2: Unwrap paragraphs
  let unwrappedCount = 0;
  if (options.unwrapParagraphs !== false) {
    const unwrapResult = unwrapParagraphs(content);
    content = unwrapResult.content;
    unwrappedCount = unwrapResult.unwrappedCount;
    ambiguousPositions.push(...unwrapResult.ambiguousPositions);
  }

  // Step 3: Normalize punctuation
  let punctuationChanges = 0;
  if (options.normalizePunctuation !== false && !options.preserveArchaic) {
    const punctResult = normalizePunctuation(content);
    content = punctResult.content;
    punctuationChanges = punctResult.changes;
    lowConfidencePunctuation.push(...punctResult.lowConfidencePositions);
  }

  // Step 4: Detect chapters (for flag generation, but content stays whole)
  const chapterResult = detectChapterBoundaries(content);

  // Collect unlabeled breaks from chapter detection
  for (const break_ of chapterResult.unlabeledBreaks) {
    unlabeledBreaks.push({
      offset: break_.offset,
      pattern: break_.pattern,
      lineNumber: break_.lineNumber,
    });
  }

  return {
    content,
    boilerplateStripped: boilerplateResult.startMarkerFound && boilerplateResult.endMarkerFound,
    startMarkerFound: boilerplateResult.startMarkerFound,
    endMarkerFound: boilerplateResult.endMarkerFound,
    unwrappedCount,
    punctuationChanges,
    chaptersDetected: chapterResult.chapters.length,
    unlabeledBreaks,
    ambiguousPositions,
    lowConfidencePunctuation,
  };
}

/**
 * Internal action to run deterministic cleanup
 */
export const runDeterministicCleanupAction = internalAction({
  args: {
    bookId: v.id("books"),
    text: v.string(),
    preserveArchaic: v.optional(v.boolean()),
  },
  returns: v.object({
    content: v.string(),
    boilerplateStripped: v.boolean(),
    startMarkerFound: v.boolean(),
    endMarkerFound: v.boolean(),
    unwrappedCount: v.number(),
    punctuationChanges: v.number(),
    chaptersDetected: v.number(),
    unlabeledBreaks: v.array(v.object({ offset: v.number(), pattern: v.string(), lineNumber: v.number() })),
    ambiguousPositions: v.array(v.object({ offset: v.number(), context: v.string(), lineNumber: v.number() })),
    lowConfidencePunctuation: v.array(v.object({ offset: v.number(), context: v.string(), lineNumber: v.number() })),
  }),
  handler: async (_ctx, args): Promise<CleanupResult> => {
    const result = runDeterministicCleanup(args.text, {
      preserveArchaic: args.preserveArchaic ?? true,
    });
    return result;
  },
});

/**
 * Internal mutation to create a cleanup revision
 * Stores content in file storage, not database (1MB limit)
 */
export const createCleanupRevision = internalMutation({
  args: {
    bookId: v.id("books"),
    revisionNumber: v.number(),
    fileId: v.id("_storage"),
    isDeterministic: v.boolean(),
    isAiAssisted: v.boolean(),
    preserveArchaic: v.boolean(),
    createdBy: v.union(v.literal("system"), v.literal("ai"), v.literal("user")),
    sizeBytes: v.number(),
  },
  returns: v.id("cleanupRevisions"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("cleanupRevisions", {
      bookId: args.bookId,
      revisionNumber: args.revisionNumber,
      fileId: args.fileId,
      isDeterministic: args.isDeterministic,
      isAiAssisted: args.isAiAssisted,
      preserveArchaic: args.preserveArchaic,
      createdAt: Date.now(),
      createdBy: args.createdBy,
      sizeBytes: args.sizeBytes,
    });
  },
});

/**
 * Internal mutation to create chapter records
 * Stores content in file storage, not database (1MB limit)
 */
export const createChapterRecords = internalMutation({
  args: {
    bookId: v.id("books"),
    revisionId: v.id("cleanupRevisions"),
    chapters: v.array(v.object({
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
      fileId: v.id("_storage"),  // Reference to stored chapter file
      startOffset: v.number(),
      endOffset: v.number(),
      detectedHeading: v.optional(v.string()),
      isUserConfirmed: v.boolean(),
      confidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
      isOcrCorrupted: v.boolean(),
      sizeBytes: v.number(),  // Track chapter size
    })),
  },
  returns: v.array(v.id("cleanupChapters")),
  handler: async (ctx, args) => {
    const chapterIds = [];
    for (const chapter of args.chapters) {
      const id = await ctx.db.insert("cleanupChapters", {
        bookId: args.bookId,
        revisionId: args.revisionId,
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        type: chapter.type,
        fileId: chapter.fileId,
        startOffset: chapter.startOffset,
        endOffset: chapter.endOffset,
        detectedHeading: chapter.detectedHeading,
        isUserConfirmed: chapter.isUserConfirmed,
        createdAt: Date.now(),
        sizeBytes: chapter.sizeBytes,
      });
      chapterIds.push(id);
    }
    return chapterIds;
  },
});
