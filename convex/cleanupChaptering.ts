/**
 * Chapter boundary detection and heading normalization
 * 
 * Server-side chapter detection for Gutenberg text processing.
 * Reuses logic from src/lib/cleanupText.ts but adapted for Convex environment.
 */

import { v } from "convex/values";
import { internalAction } from "./_generated/server";

// Chapter heading patterns (order matters - more specific first)
const CHAPTER_PATTERNS = [
  // Roman numeral chapters with various prefixes
  { pattern: /^(?:CHAPTER|Chapter|CHAP\.?|Chap\.?)\s+[IVX]+[.:)]?\s*[\-\—]?\s*(.+)?$/im, type: "chapter" as const },
  // Numeric chapters with various prefixes
  { pattern: /^(?:CHAPTER|Chapter|CHAP\.?|Chap\.?)\s+\d+[.:)]?\s*[\-\—]?\s*(.+)?$/im, type: "chapter" as const },
  // Letter chapters (A, B, C) with prefixes
  { pattern: /^(?:CHAPTER|Chapter|CHAP\.?|Chap\.?)\s+[A-Z][.:)]?\s*[\-\—]?\s*(.+)?$/im, type: "chapter" as const },
  // Preface variants
  { pattern: /^(?:PREFACE|Preface|PREFECE|Prefece|PREFACE\.|Preface\.)[.:)]?\s*(.+)?$/im, type: "preface" as const },
  // Introduction variants
  { pattern: /^(?:INTRODUCTION|Introduction|INTRODUTION|Introdution)[.:)]?\s*(.+)?$/im, type: "introduction" as const },
  // Book/Part patterns (treat as high-level sections)
  { pattern: /^(?:BOOK|Book|PART|Part|PART|Part)\s+[IVX\d]+[.:)]?\s*[\-\—]?\s*(.+)?$/im, type: "chapter" as const },
  // Appendix variants
  { pattern: /^(?:APPENDIX|Appendix|APPENDICES)[\s\d]*[.:)]?\s*(.+)?$/im, type: "appendix" as const },
  // Notes variants
  { pattern: /^(?:NOTES|Notes|NOTE|Note|FOOTNOTES|Footnotes|END NOTES|End Notes)[.:)]?\s*(.+)?$/im, type: "notes" as const },
  // Prologue/Epilogue
  { pattern: /^(?:PROLOGUE|Prologue|EPILOGUE|Epilogue)[.:)]?\s*(.+)?$/im, type: "chapter" as const },
];

// OCR corruption patterns for chapter headings
const OCR_CORRUPTION_PATTERNS = [
  /^CH[\w\d]?PT[\w\d]?R\s+[IVX\d]+/im,
  /^CH[\w\d]+ER\s+[IVX\d]+/im,
  /^CHAP[\w\d]?ER\s+[IVX\d]+/im,
];

// Section break patterns that might indicate chapters without headings
const SECTION_BREAK_PATTERNS = [
  { pattern: /^\s*[-*_]{3,}\s*$/m, name: "asterisk/dash rule" },
  { pattern: /^\s*#{3,}\s*$/m, name: "hash rule" },
  { pattern: /^\s*\*\s*\*\s*\*\s*$/m, name: "spaced asterisks" },
];

/**
 * Detect if a line is a chapter heading
 */
export function detectChapterHeading(line: string): {
  isHeading: boolean;
  title: string | null;
  type: "chapter" | "preface" | "introduction" | "notes" | "appendix" | "body" | null;
  confidence: "high" | "medium" | "low";
  isOcrCorrupted: boolean;
  rawHeading: string | null;
} {
  const trimmed = line.trim();

  if (!trimmed) {
    return { isHeading: false, title: null, type: null, confidence: "high", isOcrCorrupted: false, rawHeading: null };
  }

  // Check standard patterns
  for (const { pattern, type } of CHAPTER_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const fullMatch = match[0];
      const capturedTitle = match[1]?.trim() || null;

      let title = capturedTitle;
      if (!title) {
        const numMatch = fullMatch.match(/[IVX]+|\d+|[A-Z]/i);
        if (numMatch) {
          const prefix = type.charAt(0).toUpperCase() + type.slice(1);
          title = `${prefix} ${numMatch[0]}`;
        } else {
          title = fullMatch;
        }
      }

      return {
        isHeading: true,
        title: normalizeChapterTitle(title),
        type,
        confidence: "high",
        isOcrCorrupted: false,
        rawHeading: trimmed,
      };
    }
  }

  // Check OCR corruption patterns
  for (const pattern of OCR_CORRUPTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      const numMatch = trimmed.match(/[IVX]+|\d+/);
      const title = numMatch ? `Chapter ${numMatch[0]}` : trimmed;
      return {
        isHeading: true,
        title: normalizeChapterTitle(title),
        type: "chapter",
        confidence: "medium",
        isOcrCorrupted: true,
        rawHeading: trimmed,
      };
    }
  }

  return { isHeading: false, title: null, type: null, confidence: "high", isOcrCorrupted: false, rawHeading: null };
}

/**
 * Normalize chapter title formatting
 */
export function normalizeChapterTitle(title: string): string {
  let normalized = title.trim().replace(/\s+/g, " ");

  normalized = normalized
    .replace(/^Chap\.?\s*/i, "Chapter ")
    .replace(/^Ch\.?\s*/i, "Chapter ");

  normalized = normalized.replace(/\b([ivx]+)\b/gi, (match) => match.toUpperCase());

  normalized = normalized.replace(/\b\w+/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  return normalized;
}

/**
 * Detect potential section breaks
 */
export function detectSectionBreak(line: string): {
  isBreak: boolean;
  confidence: "high" | "medium" | "low";
  pattern: string | null;
  patternName: string | null;
} {
  const trimmed = line.trim();

  for (const { pattern, name } of SECTION_BREAK_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isBreak: true,
        confidence: "medium",
        pattern: trimmed.slice(0, 20),
        patternName: name,
      };
    }
  }

  return { isBreak: false, confidence: "high", pattern: null, patternName: null };
}

/**
 * Chapter segment result
 */
export interface ChapterSegment {
  chapterNumber: number;
  title: string;
  type: "chapter" | "preface" | "introduction" | "notes" | "appendix" | "body";
  content: string;
  startOffset: number;
  endOffset: number;
  detectedHeading: string | null;
  isUserConfirmed: boolean;
  confidence: "high" | "medium" | "low";
  isOcrCorrupted: boolean;
}

/**
 * Detect chapter boundaries in text
 */
export function detectChapterBoundaries(text: string): {
  chapters: ChapterSegment[];
  unlabeledBreaks: Array<{ offset: number; pattern: string; patternName: string; lineNumber: number }>;
  hasChapters: boolean;
  totalLines: number;
} {
  const lines = text.split("\n");
  const chapters: ChapterSegment[] = [];
  const unlabeledBreaks: Array<{ offset: number; pattern: string; patternName: string; lineNumber: number }> = [];
  let currentOffset = 0;
  let pendingChapter: Partial<ChapterSegment> | null = null;
  let chapterContent: string[] = [];
  let chapterStartOffset = 0;
  let chapterStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const headingCheck = detectChapterHeading(trimmed);

    if (headingCheck.isHeading && (headingCheck.confidence === "high" || headingCheck.confidence === "medium")) {
      // Save previous chapter
      if (pendingChapter) {
        chapters.push({
          ...pendingChapter,
          content: chapterContent.join("\n"),
          endOffset: currentOffset,
        } as ChapterSegment);
      }

      // Start new chapter
      chapterStartOffset = currentOffset;
      chapterStartLine = i;
      chapterContent = [];
      pendingChapter = {
        chapterNumber: chapters.length + 1,
        title: headingCheck.title || `Section ${chapters.length + 1}`,
        type: headingCheck.type || "chapter",
        startOffset: chapterStartOffset,
        detectedHeading: headingCheck.rawHeading,
        isUserConfirmed: false,
        confidence: headingCheck.confidence,
        isOcrCorrupted: headingCheck.isOcrCorrupted || false,
      };
    } else {
      // Check for unlabeled section breaks
      const breakCheck = detectSectionBreak(trimmed);
      if (breakCheck.isBreak && pendingChapter) {
        unlabeledBreaks.push({
          offset: currentOffset,
          pattern: breakCheck.pattern || trimmed,
          patternName: breakCheck.patternName || "unknown",
          lineNumber: i,
        });
      }

      if (pendingChapter) {
        chapterContent.push(line);
      }
    }

    currentOffset += line.length + 1;
  }

  // Don't forget the last chapter
  if (pendingChapter) {
    chapters.push({
      ...pendingChapter,
      content: chapterContent.join("\n"),
      endOffset: currentOffset,
    } as ChapterSegment);
  }

  // If no chapters detected, create single body chapter
  if (chapters.length === 0) {
    chapters.push({
      chapterNumber: 1,
      title: "Body",
      type: "body",
      content: text,
      startOffset: 0,
      endOffset: text.length,
      detectedHeading: null,
      isUserConfirmed: false,
      confidence: "high",
      isOcrCorrupted: false,
    });
  }

  return {
    chapters,
    unlabeledBreaks,
    hasChapters: chapters.some(c => c.type === "chapter"),
    totalLines: lines.length,
  };
}

/**
 * Internal action to detect chapters (for testing)
 */
export const detectChaptersAction = internalAction({
  args: {
    text: v.string(),
  },
  handler: async (_ctx, args): Promise<{
    chapters: ChapterSegment[];
    unlabeledBreakCount: number;
    hasChapters: boolean;
  }> => {
    const result = detectChapterBoundaries(args.text);
    return {
      chapters: result.chapters,
      unlabeledBreakCount: result.unlabeledBreaks.length,
      hasChapters: result.hasChapters,
    };
  },
});
