/**
 * Deterministic text cleanup utilities for Gutenberg text processing
 * 
 * These functions operate purely on text content without external dependencies,
 * suitable for both client-side preview and server-side processing.
 */

// Common Gutenberg boilerplate patterns
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

// Chapter heading patterns (order matters - more specific first)
const CHAPTER_PATTERNS = [
  // Roman numeral chapters with various prefixes
  /^(?:CHAPTER|Chapter|CHAP\.?|Chap\.?)\s+[IVX]+[.:)]?\s*[\-\—]?\s*(.+)?$/im,
  // Numeric chapters with various prefixes
  /^(?:CHAPTER|Chapter|CHAP\.?|Chap\.?)\s+\d+[.:)]?\s*[\-\—]?\s*(.+)?$/im,
  // Letter chapters (A, B, C) with prefixes
  /^(?:CHAPTER|Chapter|CHAP\.?|Chap\.?)\s+[A-Z][.:)]?\s*[\-\—]?\s*(.+)?$/im,
  // Preface variants
  /^(?:PREFACE|Preface|PREFECE|Prefece|PREFACE\.|Preface\.)[.:)]?\s*(.+)?$/im,
  // Introduction variants
  /^(?:INTRODUCTION|Introduction|INTRODUTION|Introdution)[.:)]?\s*(.+)?$/im,
  // Book/Part patterns (treat as high-level sections)
  /^(?:BOOK|Book|PART|Part|PART|Part)\s+[IVX\d]+[.:)]?\s*[\-\—]?\s*(.+)?$/im,
  // Appendix variants
  /^(?:APPENDIX|Appendix|APPENDICES)[\s\d]*[.:)]?\s*(.+)?$/im,
  // Notes variants
  /^(?:NOTES|Notes|NOTE|Note|FOOTNOTES|Footnotes|END NOTES|End Notes)[.:)]?\s*(.+)?$/im,
  // Prologue/Epilogue
  /^(?:PROLOGUE|Prologue|EPILOGUE|Epilogue)[.:)]?\s*(.+)?$/im,
];

// Section break patterns that might indicate chapters without headings
const SECTION_BREAK_PATTERNS = [
  /^\s*[-*_]{3,}\s*$/m,           // *** or --- or ___ separators
  /^\s*#{3,}\s*$/m,                   // ### separators
  /^\s*\*\s*\*\s*\*\s*$/m,          // * * * separators
];

// OCR corruption patterns for chapter headings
const OCR_CORRUPTION_PATTERNS = [
  /^CH[\w\d]?PT[\w\d]?R\s+[IVX\d]+/im,     // CHPTER/CHAPTR variants
  /^CH[\w\d]+ER\s+[IVX\d]+/im,            // CHATER/CHAPPER variants
  /^CHAP[\w\d]?ER\s+[IVX\d]+/im,          // CHAPTR variants
];

/**
 * Extract content between Gutenberg boilerplate markers
 */
export function stripGutenbergBoilerplate(text: string): {
  content: string;
  startMarkerFound: boolean;
  endMarkerFound: boolean;
} {
  let content = text;
  let startMarkerFound = false;
  let endMarkerFound = false;

  // Find and strip start marker
  for (const pattern of GUTENBERG_START_MARKERS) {
    const match = content.match(pattern);
    if (match && match.index !== undefined) {
      content = content.slice(match.index + match[0].length);
      startMarkerFound = true;
      break;
    }
  }

  // Find and strip end marker
  for (const pattern of GUTENBERG_END_MARKERS) {
    const match = content.match(pattern);
    if (match && match.index !== undefined) {
      content = content.slice(0, match.index);
      endMarkerFound = true;
      break;
    }
  }

  // Trim whitespace
  content = content.trim();

  return { content, startMarkerFound, endMarkerFound };
}

/**
 * Detect if a line is a chapter heading
 */
export function detectChapterHeading(line: string): {
  isHeading: boolean;
  title: string | null;
  type: "chapter" | "preface" | "introduction" | "notes" | "appendix" | "body" | null;
  confidence: "high" | "medium" | "low";
  isOcrCorrupted: boolean;
} {
  const trimmed = line.trim();

  // Empty lines aren't headings
  if (!trimmed) {
    return { isHeading: false, title: null, type: null, confidence: "high", isOcrCorrupted: false };
  }

  // Check standard patterns
  for (const pattern of CHAPTER_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const fullMatch = match[0];
      const capturedTitle = match[1]?.trim() || null;
      
      // Determine type from pattern
      let type: typeof CHAPTER_PATTERNS extends Array<infer T> ? never : "chapter" = "chapter";
      const lower = fullMatch.toLowerCase();
      if (lower.includes("preface")) type = "preface";
      else if (lower.includes("introduction")) type = "introduction";
      else if (lower.includes("appendix")) type = "appendix";
      else if (lower.includes("note")) type = "notes";
      else if (lower.includes("prologue") || lower.includes("epilogue")) type = "chapter";
      else if (lower.includes("book") || lower.includes("part")) type = "chapter";

      // Extract title - either captured group or generate from number
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
      };
    }
  }

  // Check OCR corruption patterns (still valid headings, just flagged)
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
      };
    }
  }

  return { isHeading: false, title: null, type: null, confidence: "high", isOcrCorrupted: false };
}

/**
 * Normalize chapter title formatting
 */
export function normalizeChapterTitle(title: string): string {
  // Trim and clean whitespace
  let normalized = title.trim().replace(/\s+/g, " ");

  // Standardize common abbreviations
  normalized = normalized
    .replace(/^Chap\.?\s*/i, "Chapter ")
    .replace(/^Ch\.?\s*/i, "Chapter ");

  // Ensure Roman numerals are uppercase
  normalized = normalized.replace(/\b([ivx]+)\b/gi, (match) => match.toUpperCase());

  // Capitalize first letter of each word, but respect archaic spelling
  normalized = normalized.replace(/\b\w+/g, (word) => {
    // Don't modernize archaic words that might be intentional
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  return normalized;
}

/**
 * Detect potential section breaks that might be unlabeled chapter boundaries
 */
export function detectSectionBreak(line: string): {
  isBreak: boolean;
  confidence: "high" | "medium" | "low";
  pattern: string | null;
} {
  const trimmed = line.trim();

  for (const pattern of SECTION_BREAK_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isBreak: true,
        confidence: "medium",
        pattern: trimmed.slice(0, 20),
      };
    }
  }

  return { isBreak: false, confidence: "high", pattern: null };
}

/**
 * Apply balanced paragraph unwrapping
 * 
 * Strategy: Look for lines that end mid-sentence and merge with next line
 * only when continuation signals are strong.
 */
export function unwrapParagraphs(text: string): {
  content: string;
  unwrappedCount: number;
  ambiguousPositions: Array<{ offset: number; context: string }>;
} {
  const lines = text.split("\n");
  const result: string[] = [];
  let currentParagraph = "";
  let unwrappedCount = 0;
  const ambiguousPositions: Array<{ offset: number; context: string }> = [];
  let currentOffset = 0;

  const SENTENCE_ENDERS = /[.!?]["']?\s*$/;
  const STRONG_CONTINUATION = /^[a-z]/;
  const LIKELY_HEADER = /^(CHAPTER|BOOK|PART|SCENE|ACT)\s/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : null;

    // Skip empty lines - they're paragraph breaks
    if (!trimmed) {
      if (currentParagraph) {
        result.push(currentParagraph);
        currentParagraph = "";
      }
      result.push("");
      currentOffset += line.length + 1;
      continue;
    }

    // Check for chapter headings - never unwrap across these
    const headingCheck = detectChapterHeading(trimmed);
    if (headingCheck.isHeading && headingCheck.confidence === "high") {
      if (currentParagraph) {
        result.push(currentParagraph);
        currentParagraph = "";
      }
      result.push(trimmed);
      currentOffset += line.length + 1;
      continue;
    }

    // Start new paragraph if we don't have one
    if (!currentParagraph) {
      currentParagraph = trimmed;
      currentOffset += line.length + 1;
      continue;
    }

    // Decision: unwrap or new paragraph?
    const endsWithSentence = SENTENCE_ENDERS.test(currentParagraph);
    const nextStartsLower = nextLine ? STRONG_CONTINUATION.test(nextLine) : false;
    const currentLooksLikeHeader = LIKELY_HEADER.test(currentParagraph);

    if (!endsWithSentence && nextStartsLower && !currentLooksLikeHeader) {
      // Strong continuation signal - unwrap
      currentParagraph += " " + trimmed;
      unwrappedCount++;
    } else if (!endsWithSentence && nextLine && !nextLine.match(/^[A-Z]/)) {
      // Ambiguous case - make a best effort but flag it
      const contextStart = Math.max(0, currentParagraph.length - 30);
      ambiguousPositions.push({
        offset: currentOffset + contextStart,
        context: `${currentParagraph.slice(contextStart)} || ${trimmed.slice(0, 30)}`,
      });
      currentParagraph += " " + trimmed;
      unwrappedCount++;
    } else {
      // New paragraph
      result.push(currentParagraph);
      currentParagraph = trimmed;
    }

    currentOffset += line.length + 1;
  }

  // Don't forget the last paragraph
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
  changes: Array<{ original: string; replacement: string; offset: number }>;
  lowConfidencePositions: Array<{ offset: number; context: string }>;
} {
  const changes: Array<{ original: string; replacement: string; offset: number }> = [];
  const lowConfidencePositions: Array<{ offset: number; context: string }> = [];

  let result = text;
  let offset = 0;

  // High-confidence replacements
  const highConfidenceReplacements: Array<[RegExp, string, string]> = [
    // Multiple spaces after sentence
    [/([.!?])  +/g, "$1 ", "multiple spaces after sentence"],
    // Straight quotes to curly (conservative)
    [/([a-zA-Z.,;:!?])"/g, "$1\"", "closing quote"],
    [/^"([a-zA-Z])/gm, "\"$1", "opening quote at line start"],
    // Dash patterns
    [/--/g, "—", "double dash to em dash"],
    // Ellipsis
    [/\.\.\./g, "…", "ellipsis"],
  ];

  for (const [pattern, replacement, description] of highConfidenceReplacements) {
    result = result.replace(pattern, (match, ...args) => {
      const matchOffset = args[args.length - 2];
      changes.push({
        original: match,
        replacement: typeof replacement === "function" ? replacement(match, ...args) : replacement,
        offset: matchOffset,
      });
      return typeof replacement === "function" ? replacement(match, ...args) : replacement;
    });
  }

  // Flag low-confidence patterns (archaic punctuation that might be intentional)
  const lowConfidencePatterns = [
    { pattern: /\b([a-zA-Z]+)'([a-zA-Z]+)\b/g, description: "possessive/contraction apostrophe" },
    { pattern: /;\s*$/gm, description: "semicolon at line end" },
  ];

  for (const { pattern, description } of lowConfidencePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      lowConfidencePositions.push({
        offset: match.index,
        context: `${description}: "${match[0]}"`,
      });
    }
  }

  return { content: result, changes, lowConfidencePositions };
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
): {
  content: string;
  boilerplateStripped: boolean;
  unwrappedCount: number;
  punctuationChanges: number;
  ambiguousPositions: Array<{ offset: number; context: string }>;
  flags: Array<{ type: string; offset: number; context: string }>;
} {
  const flags: Array<{ type: string; offset: number; context: string }> = [];
  let ambiguousPositions: Array<{ offset: number; context: string }> = [];

  // Step 1: Strip boilerplate
  const boilerplateResult = stripGutenbergBoilerplate(text);
  let content = boilerplateResult.content;

  if (!boilerplateResult.startMarkerFound) {
    flags.push({ type: "boilerplate_start_missing", offset: 0, context: "Start marker not detected" });
  }
  if (!boilerplateResult.endMarkerFound) {
    flags.push({ type: "boilerplate_end_missing", offset: content.length - 50, context: "End marker not detected" });
  }

  // Step 2: Unwrap paragraphs
  let unwrappedCount = 0;
  if (options.unwrapParagraphs !== false) {
    const unwrapResult = unwrapParagraphs(content);
    content = unwrapResult.content;
    unwrappedCount = unwrapResult.unwrappedCount;
    ambiguousPositions = ambiguousPositions.concat(unwrapResult.ambiguousPositions);
  }

  // Step 3: Normalize punctuation
  let punctuationChanges = 0;
  if (options.normalizePunctuation !== false && !options.preserveArchaic) {
    const punctResult = normalizePunctuation(content);
    content = punctResult.content;
    punctuationChanges = punctResult.changes.length;
    
    for (const pos of punctResult.lowConfidencePositions) {
      flags.push({ type: "low_confidence_punctuation", offset: pos.offset, context: pos.context });
    }
  }

  // Add ambiguous positions as flags
  for (const pos of ambiguousPositions) {
    flags.push({ type: "ambiguous_paragraph_unwrap", offset: pos.offset, context: pos.context });
  }

  return {
    content,
    boilerplateStripped: boilerplateResult.startMarkerFound && boilerplateResult.endMarkerFound,
    unwrappedCount,
    punctuationChanges,
    ambiguousPositions,
    flags,
  };
}

/**
 * Chapter detection result
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
 * Detect chapter boundaries in cleaned text
 */
export function detectChapterBoundaries(
  text: string,
): {
  chapters: ChapterSegment[];
  unlabeledBreaks: Array<{ offset: number; pattern: string }>;
  hasChapters: boolean;
} {
  const lines = text.split("\n");
  const chapters: ChapterSegment[] = [];
  const unlabeledBreaks: Array<{ offset: number; pattern: string }> = [];
  let currentOffset = 0;
  let pendingChapter: Partial<ChapterSegment> | null = null;
  let chapterContent: string[] = [];
  let chapterStartOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for chapter heading
    const headingCheck = detectChapterHeading(trimmed);

    if (headingCheck.isHeading && headingCheck.confidence === "high") {
      // Save previous chapter if exists
      if (pendingChapter) {
        const endOffset = currentOffset;
        chapters.push({
          ...pendingChapter,
          content: chapterContent.join("\n"),
          endOffset,
        } as ChapterSegment);
      }

      // Start new chapter
      chapterStartOffset = currentOffset;
      chapterContent = [];
      pendingChapter = {
        chapterNumber: chapters.length + 1,
        title: headingCheck.title || `Section ${chapters.length + 1}`,
        type: headingCheck.type || "chapter",
        startOffset: chapterStartOffset,
        detectedHeading: trimmed,
        isUserConfirmed: false,
        confidence: headingCheck.confidence,
        isOcrCorrupted: headingCheck.isOcrCorrupted || false,
      };
    } else if (headingCheck.isHeading && headingCheck.confidence === "medium") {
      // OCR-corrupted but valid - include with flag
      if (pendingChapter) {
        const endOffset = currentOffset;
        chapters.push({
          ...pendingChapter,
          content: chapterContent.join("\n"),
          endOffset,
        } as ChapterSegment);
      }

      chapterStartOffset = currentOffset;
      chapterContent = [];
      pendingChapter = {
        chapterNumber: chapters.length + 1,
        title: headingCheck.title || `Section ${chapters.length + 1}`,
        type: headingCheck.type || "chapter",
        startOffset: chapterStartOffset,
        detectedHeading: trimmed,
        isUserConfirmed: false,
        confidence: headingCheck.confidence,
        isOcrCorrupted: true,
      };
    } else {
      // Check for unlabeled section breaks
      const breakCheck = detectSectionBreak(trimmed);
      if (breakCheck.isBreak) {
        unlabeledBreaks.push({
          offset: currentOffset,
          pattern: breakCheck.pattern || trimmed,
        });
      }

      // Accumulate content
      if (pendingChapter) {
        chapterContent.push(line);
      }
    }

    currentOffset += line.length + 1; // +1 for newline
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
  };
}
