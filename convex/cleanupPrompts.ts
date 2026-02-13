/**
 * AI Cleanup Prompts and Schemas
 *
 * Centralized prompt management and Zod schemas for structured AI responses.
 * All prompts enforce the preservation-first policy from CONTEXT.md.
 */

import { z } from "zod";

// =============================================================================
// Zod Schemas for Structured AI Output
// =============================================================================

/**
 * Single cleanup patch - represents one AI-suggested edit
 */
export const CleanupPatchSchema = z.object({
  start: z.number().int().min(0).describe("Character offset where edit starts"),
  end: z
    .number()
    .int()
    .min(0)
    .describe("Character offset where edit ends (exclusive)"),
  original: z
    .string()
    .describe("Original text being replaced (must match text[start:end])"),
  replacement: z.string().describe("Proposed replacement text"),
  confidence: z
    .enum(["high", "low"])
    .describe(
      "Confidence level: 'high' for clear OCR errors, 'low' for uncertain or stylistic suggestions",
    ),
  confidenceScore: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      "Optional numeric confidence score in [0, 1]; when absent, use confidence label mapping",
    ),
  reason: z.string().max(200).describe("Brief explanation for the edit"),
  category: z
    .enum([
      "ocr_error",
      "punctuation_normalization",
      "typo_correction",
      "hyphenation_fix",
      "formatting",
    ])
    .describe("Category of the edit for filtering and review"),
});

export type CleanupPatch = z.infer<typeof CleanupPatchSchema>;

export const CLEANUP_CONFIDENCE_LABEL_SCORES = {
  high: 0.9,
  low: 0.55,
} as const;

function clampUnitInterval(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeConfidenceScore(value: number): number | null {
  if (Number.isNaN(value)) {
    return null;
  }
  if (value === Number.POSITIVE_INFINITY) {
    return 1;
  }
  if (value === Number.NEGATIVE_INFINITY) {
    return 0;
  }
  return clampUnitInterval(value);
}

/**
 * Derive effective numeric confidence for policy decisions.
 *
 * - Uses explicit confidenceScore when valid
 * - Falls back to confidence label mapping
 * - Safely normalizes non-finite values
 */
export function deriveEffectivePatchConfidenceScore(
  patch: Pick<CleanupPatch, "confidence" | "confidenceScore">,
): number {
  if (typeof patch.confidenceScore === "number") {
    const normalized = normalizeConfidenceScore(patch.confidenceScore);
    if (normalized !== null) {
      return normalized;
    }
  }

  return CLEANUP_CONFIDENCE_LABEL_SCORES[patch.confidence];
}

/**
 * Full AI cleanup response
 */
export const CleanupResponseSchema = z.object({
  patches: z
    .array(CleanupPatchSchema)
    .describe("Array of edit patches to apply"),
  summary: z
    .string()
    .max(500)
    .describe("Brief summary of all suggested changes"),
  preservationNotes: z
    .array(z.string())
    .describe(
      "Notes about archaic or unusual elements that were intentionally preserved",
    ),
  stats: z
    .object({
      highConfidencePatches: z.number().int().min(0),
      lowConfidencePatches: z.number().int().min(0),
      ocrErrorsFixed: z.number().int().min(0),
      punctuationNormalizations: z.number().int().min(0),
    })
    .describe("Statistics about the cleanup operation"),
});

export type CleanupResponse = z.infer<typeof CleanupResponseSchema>;

// =============================================================================
// System Prompts
// =============================================================================

/**
 * Main system prompt for cleanup AI
 * Enforces preservation-first policy per CONTEXT.md decisions
 */
export const CLEANUP_SYSTEM_PROMPT = `You are a preservation-focused text editor specializing in cleaning OCR-scanned public domain literature.

## Core Mission
Improve text quality by fixing OCR errors and normalizing punctuation while ABSOLUTELY PRESERVING the author's original voice, spelling, and grammar from their era.

## STRICT PRESERVATION RULES (Never Violate)
1. ARCHAIC SPELLING: Keep period-appropriate spellings
   - "to-day", "to-morrow", "to-night" → KEEP (do not modernize)
   - "shewn", "colour", "honour" → KEEP
   - "analyse", "paralyse" (British) → KEEP
   - Any unusual or old spelling → KEEP unless clearly an OCR error

2. ARCHAIC GRAMMAR: Preserve historical language patterns
   - "thou hast", "thee", "thy" → KEEP
   - "‘Twas", "‘Tis" (apostrophe contractions) → KEEP
   - "data are" vs "data is" → KEEP author's choice
   - Subjunctive forms ("if I were", "be he alive") → KEEP

3. DIALECT & DIALOGUE: Preserve all speech patterns
   - Colloquialisms, regionalisms, non-standard grammar in dialogue → KEEP
   - Dropped g's ("goin'", "runnin'") → KEEP
   - Eye dialect ("wuz", "sez") → KEEP unless clearly OCR error

4. STYLISTIC CHOICES: Do not "improve" writing
   - Repetition for emphasis → KEEP
   - Unusual punctuation for effect → KEEP
   - Sentence fragments → KEEP
   - Long, complex Victorian sentences → KEEP

## What You MAY Fix (with appropriate confidence)

### HIGH CONFIDENCE (Clear OCR Errors)
- Garbled characters: "1ove" → "love", "f0r" → "for"
- Wrong letters: "bumed" → "burned" (if context clearly indicates)
- Split words at line breaks: "con-\nversation" → "conversation"
- Doubled words: "the the" → "the"
- Clear substitution errors from OCR misrecognition

### LOW CONFIDENCE (Uncertain, Flag for Review)
- Any word that could be archaic or could be a typo
- Punctuation in ambiguous contexts
- Capitalization that might be intentional emphasis
- Words that exist but seem out of context

## OUTPUT FORMAT
Respond with a JSON object matching this structure:
{
  "patches": [
    {
      "start": 0,
      "end": 5,
      "original": "text",
      "replacement": "fixed",
      "confidence": "high" | "low",
      "confidenceScore": 0.0 to 1.0 (optional),
      "reason": "Clear OCR error: 1 should be l",
      "category": "ocr_error" | "punctuation_normalization" | "typo_correction" | "hyphenation_fix" | "formatting"
    }
  ],
  "summary": "Brief description of changes",
  "preservationNotes": ["Preserved 'to-day' as archaic spelling", "Kept dialect in dialogue"],
  "stats": {
    "highConfidencePatches": 5,
    "lowConfidencePatches": 2,
    "ocrErrorsFixed": 3,
    "punctuationNormalizations": 4
  }
}

## REMEMBER
When in doubt, preserve. A missed archaic spelling is better than an unwarranted modernization.
`;

/**
 * Prompt for analyzing text segments with chapter context
 */
export function buildSegmentPrompt(
  text: string,
  options: {
    chapterTitle?: string;
    chapterNumber?: number;
    totalChapters?: number;
    segmentNumber?: number;
    totalSegments?: number;
    previousContext?: string;
    nextContext?: string;
    isDialogueHeavy?: boolean;
  } = {},
): string {
  let prompt = "# Text Cleanup Analysis Request\n\n";

  // Add context header
  if (options.chapterTitle || options.chapterNumber) {
    prompt += "## Chapter Context\n";
    if (options.chapterTitle) {
      prompt += `Title: ${options.chapterTitle}\n`;
    }
    if (options.chapterNumber && options.totalChapters) {
      prompt += `Position: Chapter ${options.chapterNumber} of ${options.totalChapters}\n`;
    } else if (options.chapterNumber) {
      prompt += `Chapter: ${options.chapterNumber}\n`;
    }
    prompt += "\n";
  }

  // Add segment context
  if (options.segmentNumber && options.totalSegments) {
    prompt += `## Segment ${options.segmentNumber} of ${options.totalSegments}\n\n`;
  }

  // Add content notes
  if (options.isDialogueHeavy) {
    prompt += "## Content Note\n";
    prompt +=
      "This segment contains substantial dialogue. Be extra careful to preserve dialect, colloquialisms, and speech patterns.\n\n";
  }

  // Add surrounding context for continuity
  if (options.previousContext) {
    const truncated = options.previousContext.slice(-300);
    prompt += `## Preceding Context (for continuity)\n\`\`\`\n...${truncated}\n\`\`\`\n\n`;
  }

  // Main text to analyze
  prompt += "## TEXT TO ANALYZE\n\n";
  prompt += "```\n";
  prompt += text;
  prompt += "\n```\n\n";

  if (options.nextContext) {
    const truncated = options.nextContext.slice(0, 300);
    prompt += `## Following Context (for continuity)\n\`\`\`\n${truncated}...\n\`\`\`\n\n`;
  }

  // Response instructions
  prompt += "## Instructions\n";
  prompt += "Analyze the TEXT TO ANALYZE section above.\n";
  prompt += "Suggest edits following the preservation-first policy.\n";
  prompt += "Return your response as JSON matching the specified schema.\n";
  prompt += "If no changes are needed, return an empty patches array.\n";

  return prompt;
}

/**
 * Prompt for final summary after processing all segments
 */
export function buildFinalSummaryPrompt(
  segmentSummaries: string[],
  totalPatches: number,
  lowConfidenceCount: number,
): string {
  return `# Cleanup Summary Request

## Segment Summaries
${segmentSummaries.map((s, i) => `Segment ${i + 1}: ${s}`).join("\n")}

## Statistics
- Total patches: ${totalPatches}
- Low confidence patches: ${lowConfidenceCount}

## Request
Provide a brief overall summary of the cleanup operation and any preservation notes that apply to the entire document.

Respond with JSON:
{
  "overallSummary": "Brief description of overall changes",
  "preservationHighlights": ["Key archaic elements preserved", "Notable stylistic choices kept"],
  "recommendations": ["Any suggestions for manual review"]
}
`;
}

// =============================================================================
// Response Validation Helpers
// =============================================================================

/**
 * Validate and sanitize AI response
 * Filters out invalid patches and normalizes the response
 */
export function validateCleanupResponse(
  rawResponse: unknown,
  originalText: string,
):
  | { success: true; data: CleanupResponse }
  | { success: false; error: string } {
  // First, validate against schema
  const parsed = CleanupResponseSchema.safeParse(rawResponse);
  if (!parsed.success) {
    return {
      success: false,
      error: `Schema validation failed: ${parsed.error.message}`,
    };
  }

  const data = parsed.data;
  const validPatches: CleanupPatch[] = [];
  const validationErrors: string[] = [];

  // Validate each patch
  for (const patch of data.patches) {
    // Check offset bounds
    if (patch.start < 0 || patch.end > originalText.length) {
      validationErrors.push(
        `Patch offsets out of bounds: ${patch.start}-${patch.end} (text length: ${originalText.length})`,
      );
      continue;
    }

    // Check start <= end
    if (patch.start > patch.end) {
      validationErrors.push(
        `Invalid patch: start (${patch.start}) > end (${patch.end})`,
      );
      continue;
    }

    // Verify original text matches
    const actualOriginal = originalText.slice(patch.start, patch.end);
    if (actualOriginal !== patch.original) {
      const preview = (value: string): string => {
        const normalized = value.replace(/\s+/g, " ").trim();
        return normalized.length <= 24
          ? normalized
          : `${normalized.slice(0, 24)}…`;
      };
      validationErrors.push(
        `Text mismatch at ${patch.start}-${patch.end}: expected(len=${patch.original.length}, preview="${preview(patch.original)}"), found(len=${actualOriginal.length}, preview="${preview(actualOriginal)}")`,
      );
      continue;
    }

    // All validations passed
    validPatches.push(patch);
  }

  // Log validation issues but don't fail
  if (validationErrors.length > 0) {
    console.warn("Patch validation warnings:", validationErrors);
  }

  return {
    success: true,
    data: {
      ...data,
      patches: validPatches,
      stats: calculatePatchStats(validPatches),
    },
  };
}

/**
 * Calculate statistics from patches
 */
export function calculatePatchStats(
  patches: CleanupPatch[],
): CleanupResponse["stats"] {
  return {
    highConfidencePatches: patches.filter((p) => p.confidence === "high")
      .length,
    lowConfidencePatches: patches.filter((p) => p.confidence === "low").length,
    ocrErrorsFixed: patches.filter((p) => p.category === "ocr_error").length,
    punctuationNormalizations: patches.filter(
      (p) => p.category === "punctuation_normalization",
    ).length,
  };
}
