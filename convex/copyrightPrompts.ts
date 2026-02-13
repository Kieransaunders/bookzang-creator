/**
 * AI Copyright Research Prompts and Schemas
 *
 * Centralized prompt management and Zod schemas for structured AI responses
 * for copyright research on public domain books.
 */

import { z } from "zod";

// =============================================================================
// Zod Schemas for Structured AI Output
// =============================================================================

/**
 * Single contributor record from AI research
 */
export const ContributorSchema = z.object({
  name: z.string().describe("Full name of the contributor"),
  role: z
    .enum([
      "author",
      "translator",
      "illustrator",
      "editor",
      "annotator",
      "introduction_writer",
      "compiler",
      "unknown",
    ])
    .describe("Role of this contributor in the work"),
  deathYear: z
    .number()
    .nullable()
    .describe("Year of death if known, null if unknown"),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("Confidence level in the death year information"),
  source: z
    .string()
    .describe(
      "Source of the information (e.g., 'Wikipedia', 'Project Gutenberg metadata', 'Library of Congress')",
    ),
  notes: z
    .string()
    .optional()
    .describe("Additional notes about this contributor"),
});

/**
 * Copyright assessment result
 */
export const CopyrightAssessmentSchema = z.object({
  status: z
    .enum(["cleared", "flagged", "blocked", "unknown"])
    .describe("Overall copyright status assessment"),
  reason: z.string().describe("Explanation of the assessment"),
  latestDeathYear: z
    .number()
    .nullable()
    .describe("The most recent death year among all contributors"),
  yearsSinceDeath: z
    .number()
    .nullable()
    .describe("Number of years since the latest death (as of current year)"),
});

/**
 * Full AI copyright research response
 */
export const CopyrightResearchResponseSchema = z.object({
  contributors: z
    .array(ContributorSchema)
    .describe("All contributors identified in the work"),
  assessment: CopyrightAssessmentSchema,
  headerAnalysis: z.object({
    scanned: z
      .boolean()
      .describe("Whether the header was successfully scanned"),
    permissionNotes: z
      .string()
      .optional()
      .describe("Any permission or copyright notices found in the header"),
    warningFlags: z
      .array(z.string())
      .describe(
        "Warning flags found in the header (e.g., 'posted with permission')",
      ),
  }),
  metadata: z.object({
    researchDate: z
      .string()
      .describe("ISO date string when research was performed"),
    gutenbergId: z
      .string()
      .optional()
      .describe("Project Gutenberg ID if available"),
    title: z.string().describe("Title of the work"),
  }),
});

// Type exports
export type Contributor = z.infer<typeof ContributorSchema>;
export type CopyrightAssessment = z.infer<typeof CopyrightAssessmentSchema>;
export type CopyrightResearchResponse = z.infer<
  typeof CopyrightResearchResponseSchema
>;

// =============================================================================
// Prompts
// =============================================================================

/**
 * Main system prompt for copyright research AI
 */
export const COPYRIGHT_RESEARCH_SYSTEM_PROMPT = `You are a copyright research specialist focused on UK public domain law.

## Your Task
Research the copyright status of a literary work by finding death dates for all rights-relevant contributors.

## UK Copyright Rules (Death + 70 Years)
- Written works: Copyright expires 70 years after the author's death (end of calendar year)
- Multiple contributors: Copyright expires 70 years after the LAST contributor's death
- Unknown death dates: Must be treated as potentially in copyright

## Contributors to Research
1. **Author(s)** - Primary writer(s) of the work
2. **Translator(s)** - If translated from another language
3. **Illustrator(s)** - Artists who created images/diagrams
4. **Editor/Annotator** - If they contributed substantial original material
5. **Introduction/Preface writer** - If separate from the author

## Assessment Criteria
- **CLEARED**: All contributors died 70+ years ago (or before 1955 for 2025)
- **FLAGGED**: Any contributor's death date is unknown OR died less than 100 years ago (safety margin)
- **BLOCKED**: Any contributor died less than 70 years ago
- **UNKNOWN**: Cannot determine enough information to assess

## Output Format
Return a JSON object with:
- contributors: array of contributor objects (name, role, deathYear, confidence, source, notes)
- assessment: object with status, reason, latestDeathYear, yearsSinceDeath
- headerAnalysis: object with scanned status, permissionNotes, warningFlags
- metadata: object with researchDate (ISO string), gutenbergId, title

## Research Guidelines
- Use your knowledge to find death dates
- Indicate confidence level: high (multiple sources agree), medium (single reliable source), low (uncertain or estimated)
- Always cite your source
- If death year is unknown, set to null and mark confidence as "low"
- Check for special permissions in the header - flag any "posted with permission" or "copyright owner" language`;

/**
 * Build user prompt for copyright research
 */
export function buildCopyrightResearchPrompt(
  headerText: string,
  metadata: {
    title?: string;
    author?: string;
    gutenbergId?: string;
  },
): string {
  let prompt =
    "Please research the copyright status of the following work.\n\n";

  if (metadata.title) {
    prompt += `Title: ${metadata.title}\n`;
  }
  if (metadata.author) {
    prompt += `Author (from metadata): ${metadata.author}\n`;
  }
  if (metadata.gutenbergId) {
    prompt += `Project Gutenberg ID: ${metadata.gutenbergId}\n`;
  }

  prompt += "\n--- PROJECT GUTENBERG HEADER ---\n";
  prompt += headerText;
  prompt += "\n--- END HEADER ---\n\n";

  prompt += `Research all contributors and their death dates. Return your findings as a JSON object matching the schema defined in your instructions.

Current year for reference: ${new Date().getFullYear()}`;

  return prompt;
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate and sanitize AI response
 */
export function validateCopyrightResponse(
  response: unknown,
):
  | { success: true; data: CopyrightResearchResponse }
  | { success: false; error: string } {
  // First, validate against schema
  const parsed = CopyrightResearchResponseSchema.safeParse(response);

  if (!parsed.success) {
    return {
      success: false,
      error: `Schema validation failed: ${parsed.error.message}`,
    };
  }

  const data = parsed.data;

  // Additional validation: ensure research date is valid
  try {
    new Date(data.metadata.researchDate);
  } catch {
    return {
      success: false,
      error: "Invalid researchDate format",
    };
  }

  // Validate assessment calculations
  if (
    data.assessment.latestDeathYear !== null &&
    data.assessment.yearsSinceDeath !== null
  ) {
    const currentYear = new Date().getFullYear();
    const calculated = currentYear - data.assessment.latestDeathYear;
    if (Math.abs(calculated - data.assessment.yearsSinceDeath) > 1) {
      return {
        success: false,
        error: `yearsSinceDeath calculation mismatch: expected ~${calculated}, got ${data.assessment.yearsSinceDeath}`,
      };
    }
  }

  return { success: true, data };
}

/**
 * Calculate copyright status based on research results
 */
export function calculateCopyrightStatus(
  contributors: Contributor[],
): CopyrightAssessment {
  const currentYear = new Date().getFullYear();
  const ukTerm = 70;
  const safetyMargin = 100; // Extra safety buffer

  // Filter out contributors with unknown death years
  const knownDeaths = contributors.filter((c) => c.deathYear !== null);
  const unknownDeaths = contributors.filter((c) => c.deathYear === null);

  if (knownDeaths.length === 0 && unknownDeaths.length > 0) {
    return {
      status: "unknown",
      reason: `No death dates found for ${unknownDeaths.length} contributor(s). Manual research required.`,
      latestDeathYear: null,
      yearsSinceDeath: null,
    };
  }

  // Find the most recent death year
  const latestDeathYear = Math.max(...knownDeaths.map((c) => c.deathYear!));
  const yearsSinceDeath = currentYear - latestDeathYear;

  // Determine status
  if (yearsSinceDeath >= safetyMargin) {
    return {
      status: "cleared",
      reason: `All contributors died ${yearsSinceDeath}+ years ago (latest: ${latestDeathYear}). Well beyond UK copyright term (+70 years).`,
      latestDeathYear,
      yearsSinceDeath,
    };
  } else if (yearsSinceDeath >= ukTerm) {
    return {
      status: "flagged",
      reason: `All contributors died ${yearsSinceDeath} years ago (latest: ${latestDeathYear}). Within copyright term but past 70-year threshold. Verify no unknown contributors.`,
      latestDeathYear,
      yearsSinceDeath,
    };
  } else {
    return {
      status: "blocked",
      reason: `Contributor died only ${yearsSinceDeath} years ago (latest: ${latestDeathYear}). Still in copyright under UK law (70 years after death).`,
      latestDeathYear,
      yearsSinceDeath,
    };
  }
}

/**
 * Extract header section from full text
 */
export function extractHeaderSection(text: string): string {
  // Look for common Gutenberg header patterns
  const headerEndMarkers = [
    /\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG/i,
    /\*\*\*START OF (?:THE|THIS) PROJECT GUTENBERG/i,
    /^\s*Produced by/i,
    /^\s*This file was produced from/i,
  ];

  let headerEnd = text.length;
  for (const marker of headerEndMarkers) {
    const match = text.search(marker);
    if (match !== -1 && match < headerEnd) {
      headerEnd = match;
    }
  }

  // Limit to reasonable size (first 5000 chars should cover most headers)
  return text.slice(0, Math.min(headerEnd, 5000)).trim();
}

/**
 * Check header for warning flags
 */
export function checkHeaderWarnings(headerText: string): string[] {
  const warnings: string[] = [];
  const warningPatterns = [
    {
      pattern: /posted with permission/i,
      message: "Posted with permission - verify republishing rights",
    },
    {
      pattern: /copyright owner/i,
      message: "Copyright owner mentioned - check terms",
    },
    { pattern: /special permission/i, message: "Special permission required" },
    {
      pattern: /all rights reserved/i,
      message: "All rights reserved notice found",
    },
    {
      pattern: /\(c\)|©|copyright \d{4}/i,
      message: "Copyright notice detected",
    },
    {
      pattern: /not in the public domain/i,
      message: "Explicitly not public domain",
    },
    {
      pattern: /permission granted/i,
      message: "Permission-based - verify scope",
    },
  ];

  for (const { pattern, message } of warningPatterns) {
    if (pattern.test(headerText)) {
      warnings.push(message);
    }
  }

  return warnings;
}
